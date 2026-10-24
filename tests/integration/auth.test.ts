// Autentikasi dan otorisasi terhadap PostgreSQL: jejak audit dalam transaksi, penguncian akun,
// TOTP dan kode cadangan, izin sesi sekali pakai, serta isolasi tenant pada data nyata.

import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { generateSecret, generateSync } from "otplib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inject } from "vitest";

// Modul aplikasi memakai getDb() yang membaca DATABASE_URL; arahkan ke basis data uji sebelum dipakai.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const { logAudit } = await import("@/lib/audit");
const { authorizeAssessmentAccess, buildPrincipal, AccessError } = await import("@/lib/auth/access");
const { completeLogin, verifyPasswordStep, verifySecondFactorStep } = await import("@/lib/auth/login");
const { bindSessionGrant } = await import("@/lib/auth/session-store");
const { rolesFor, ALL_ROLES } = await import("@/lib/auth/roles");
const { encryptField, fieldContext } = await import("@/lib/privacy/crypto");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");

async function createUser(email: string, password: string, extra: Record<string, unknown> = {}) {
  return db.user.create({
    data: { email, name: email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), ...extra },
  });
}

afterAll(async () => {
  await db.$disconnect();
});

describe("logAudit dalam transaksi yang sama dengan perubahan data", () => {
  it("tersimpan bersama perubahan bila transaksi berhasil", async () => {
    const org = await db.$transaction(async (tx) => {
      const created = await tx.organization.create({ data: { name: `Audit ${suffix}`, legalName: `PT Audit ${suffix}` } });
      await logAudit(tx, { action: "organization.create", entityType: "Organization", entityId: created.id, meta });
      return created;
    });
    expect(await db.auditLog.count({ where: { entityId: org.id, action: "organization.create" } })).toBe(1);
  });

  it("ikut batal bila transaksi gagal", async () => {
    const marker = `rollback-${suffix}`;
    await expect(
      db.$transaction(async (tx) => {
        await tx.organization.create({ data: { name: marker, legalName: marker } });
        await logAudit(tx, { action: "organization.create", entityType: "Organization", entityId: marker, meta });
        throw new Error("batal");
      }),
    ).rejects.toThrow("batal");
    expect(await db.organization.count({ where: { name: marker } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: marker } })).toBe(0);
  });

  it("menolak dipanggil di luar transaksi", async () => {
    await expect(logAudit(db as never, { action: "auth.logout", entityType: "User", meta })).rejects.toThrow(
      /inside prisma\.\$transaction/,
    );
  });
});

describe("penguncian akun", () => {
  const email = `kunci-${suffix}@contoh.test`;
  const password = "kata-sandi-benar-123";
  let userId: string;

  beforeAll(async () => {
    userId = (await createUser(email, password)).id;
  });

  it("kegagalan kelima mengunci akun; kata sandi benar tetap ditolak selama terkunci", async () => {
    for (let i = 1; i <= 4; i++) {
      expect(await verifyPasswordStep(email, "salah-salah-salah", meta)).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    }
    expect(await verifyPasswordStep(email, "salah-salah-salah", meta)).toEqual({ ok: false, error: "LOCKED" });
    expect(await verifyPasswordStep(email, password, meta)).toEqual({ ok: false, error: "LOCKED" });

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(await db.auditLog.count({ where: { entityId: userId, action: "auth.login_failed" } })).toBe(6);
    expect(await db.auditLog.count({ where: { entityId: userId, action: "auth.account_locked" } })).toBe(1);
  });

  it("setelah masa kunci berakhir, kata sandi benar diterima dan login membuka penguncian", async () => {
    await db.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    const result = await verifyPasswordStep(email, password, meta);
    expect(result).toEqual({ ok: true, userId, secondFactorRequired: false });
    await completeLogin(userId, { totpVerified: false, meta });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect([user.failedLoginCount, user.lockedUntil, user.failedLoginWindowStart]).toEqual([0, null, null]);
  });

  it("surel tidak terdaftar mendapat pesan yang sama dan tetap tercatat", async () => {
    expect(await verifyPasswordStep(`tidak-ada-${suffix}@contoh.test`, "apa saja", meta)).toEqual({
      ok: false,
      error: "INVALID_CREDENTIALS",
    });
    const entry = await db.auditLog.findFirst({ where: { action: "auth.login_failed", entityId: null }, orderBy: { at: "desc" } });
    expect(entry?.after).toEqual({ reason: "UNKNOWN_ACCOUNT" });
  });

  it("pembatas laju: lebih dari 10 percobaan per menit untuk satu akun ditolak", async () => {
    const limited = `laju-${suffix}@contoh.test`;
    for (let i = 0; i < 10; i++) await verifyPasswordStep(limited, "x", meta);
    expect(await verifyPasswordStep(limited, "x", meta)).toEqual({ ok: false, error: "RATE_LIMITED" });
  });

  it("akun nonaktif ditolak setelah kata sandi benar", async () => {
    const inactive = `nonaktif-${suffix}@contoh.test`;
    await createUser(inactive, password, { isActive: false });
    expect(await verifyPasswordStep(inactive, password, meta)).toEqual({ ok: false, error: "INACTIVE" });
  });
});

describe("faktor kedua dan izin sesi", () => {
  const email = `totp-${suffix}@contoh.test`;
  const secret = generateSecret();
  let userId: string;
  const backup = "ABCDE-FGHJK";

  beforeAll(async () => {
    const user = await createUser(email, "kata-sandi-benar-123", { totpEnabled: true });
    userId = user.id;
    await db.user.update({
      where: { id: userId },
      data: { totpSecretEnc: encryptField(secret, fieldContext("User", "totpSecretEnc", userId)) },
    });
    await db.backupCode.create({ data: { userId, codeHash: await argon2.hash("ABCDEFGHJK", { type: argon2.argon2id }) } });
  });

  it("langkah kata sandi meminta faktor kedua", async () => {
    expect(await verifyPasswordStep(email, "kata-sandi-benar-123", meta)).toEqual({ ok: true, userId, secondFactorRequired: true });
  });

  it("kode TOTP diterima sekali dan ditolak bila dipakai ulang", async () => {
    const code = generateSync({ secret });
    expect(await verifySecondFactorStep(userId, code, meta)).toEqual({ ok: true });
    expect(await verifySecondFactorStep(userId, code, meta)).toEqual({ ok: false, error: "INVALID_CODE" });
  });

  it("kode cadangan diterima sekali, lalu tidak berlaku", async () => {
    expect(await verifySecondFactorStep(userId, backup.toLowerCase(), meta)).toEqual({ ok: true });
    expect(await verifySecondFactorStep(userId, backup, meta)).toEqual({ ok: false, error: "INVALID_CODE" });
    expect(await db.auditLog.count({ where: { entityId: userId, action: "auth.backup_code_used" } })).toBe(1);
  });

  it("izin sesi hanya dapat ditukar sekali", async () => {
    const grant = await completeLogin(userId, { totpVerified: true, meta });
    const bound = await bindSessionGrant(grant);
    expect(bound?.id).toBe(userId);
    expect(await bindSessionGrant(grant)).toBeNull();
    const session = await db.userSession.findUniqueOrThrow({ where: { id: bound!.sid } });
    expect(session.totpVerified).toBe(true);
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(8 * 60 * 60 * 1000);
    expect(await db.auditLog.count({ where: { entityId: userId, action: "auth.login" } })).toBe(1);
  });

  it("izin sesi palsu atau rusak ditolak", async () => {
    expect(await bindSessionGrant("v1.palsu.palsu.palsu")).toBeNull();
    expect(await bindSessionGrant("")).toBeNull();
  });
});

describe("isolasi tenant dan cakupan unit pada data nyata", () => {
  let assessmentA: string;
  let unitA1: string;
  let unitA2: string;
  let unitB1: string;
  let orgA: string;

  beforeAll(async () => {
    // Versi instrumen tersendiri, agar asesmen uji tidak menandai NS-SCML-1.0 sebagai "sudah dipakai" bagi tes seed.
    const version = await db.instrumentVersion.create({
      data: { code: `TEST-AUTH-${suffix}`, status: "PUBLISHED", defaultParameters: {} },
    });
    const [a, b] = await Promise.all(
      ["A", "B"].map((x) => db.organization.create({ data: { name: `Org ${x} ${suffix}`, legalName: `PT ${x} ${suffix}` } })),
    );
    orgA = a.id;
    const base = { instrumentVersionId: version.id, scopeType: "CORPORATE" as const, periodStart: new Date("2026-11-01"), periodEnd: new Date("2026-12-31"), targetLevel: 4 };
    const asA = await db.assessment.create({ data: { ...base, organizationId: a.id, name: "Asesmen A" } });
    const asB = await db.assessment.create({ data: { ...base, organizationId: b.id, name: "Asesmen B" } });
    assessmentA = asA.id;
    unitA1 = (await db.unit.create({ data: { assessmentId: asA.id, name: "Proyek A1", type: "PROJECT" } })).id;
    unitA2 = (await db.unit.create({ data: { assessmentId: asA.id, name: "Proyek A2", type: "PROJECT" } })).id;
    unitB1 = (await db.unit.create({ data: { assessmentId: asB.id, name: "Proyek B1", type: "PROJECT" } })).id;
  });

  const coordinator = () =>
    buildPrincipal("koordinator", [{ organizationId: orgA, organizationIsOperator: false, role: "UNIT_COORDINATOR", unitScope: [unitA1] }]);

  it("koordinator membaca unitnya, ditolak untuk unit lain", async () => {
    const roles = rolesFor("roster", "read");
    await expect(authorizeAssessmentAccess(db, coordinator(), assessmentA, roles, { unitId: unitA1 })).resolves.toMatchObject({
      unitScope: [unitA1],
    });
    await expect(authorizeAssessmentAccess(db, coordinator(), assessmentA, roles, { unitId: unitA2 })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("unit milik asesmen lain dianggap tidak ada (404), walau id-nya valid", async () => {
    await expect(
      authorizeAssessmentAccess(db, coordinator(), assessmentA, ALL_ROLES, { unitId: unitB1 }),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(authorizeAssessmentAccess(db, coordinator(), assessmentA, ALL_ROLES, { unitId: unitB1 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("asesmen yang tidak ada mendapat 404", async () => {
    await expect(authorizeAssessmentAccess(db, coordinator(), "tidak-ada", ALL_ROLES)).rejects.toMatchObject({ status: 404 });
  });
});
