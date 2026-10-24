// Manajemen responden (docs/01 M2) terhadap PostgreSQL: impor, token hash saja, undangan dan pengingat
// melalui pg-boss, kode QR unit, dan partisipasi dari AccessToken.completedAt.

import { createHash, randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.APP_URL = "https://nscas.contoh.test";

const assessments = await import("@/lib/assessments/service");
const respondents = await import("@/lib/respondents/service");
const { loadParticipation, takeParticipationSnapshots, wibDate } = await import("@/lib/respondents/participation-data");
const { deliverInvitation } = await import("@/lib/jobs/invitations");
const { deliverReminder, scheduleReminders, MAX_REMINDERS } = await import("@/lib/jobs/reminders");
const { stopBoss } = await import("@/lib/jobs/boss");
const { loadSeedFiles, OPERATOR_ORGANIZATION } = await import("../../prisma/seeding");
const { getDb } = await import("@/lib/db");
const { SEED_DIR } = await import("./db");

import type { MailMessage } from "@/lib/mail";
import type { RespondentActor } from "@/lib/respondents/service";

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const DAY = 24 * 60 * 60 * 1000;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const tokenFrom = (link: string) => link.split("/").pop() as string;

const UNIT_NAMES = Array.from({ length: 12 }, (_, i) => `Proyek ${String(i + 1).padStart(2, "0")}`);

const MAILPIT = "http://localhost:8025";
const mailpitAvailable = await fetch(`${MAILPIT}/api/v1/info`)
  .then((r) => r.ok)
  .catch(() => false);

let versionId: string;
let clientId: string;
let session: never;

async function rejects(promise: Promise<unknown>, status: number, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "AssessmentRuleError", status, code });
}

/** Asesmen baru berstatus LOCKED dengan 12 unit dan populasi strata terisi. */
async function setupAssessment(label: string): Promise<{ actor: RespondentActor; unitIds: string[] }> {
  const orgActor = { session, organizationId: clientId, isOperator: false, roles: ["LEAD_ASSESSOR" as const] };
  const { id } = await assessments.createAssessment(
    orgActor,
    { name: `Asesmen M2 ${label}`, scopeType: "CORPORATE", periodStart: new Date("2026-11-01"), periodEnd: new Date("2027-01-31"), targetLevel: 3, instrumentVersionId: versionId },
    meta,
  );
  const unitIds: string[] = [];
  for (const name of UNIT_NAMES) {
    const unit = await db.unit.create({ data: { assessmentId: id, name, type: "PROJECT" }, select: { id: true } });
    unitIds.push(unit.id);
  }
  await db.stratum.updateMany({ where: { assessmentId: id }, data: { population: 700 } });
  await db.assessment.update({ where: { id }, data: { status: "LOCKED", lockedAt: new Date() } });
  return { actor: { session, assessmentId: id, organizationId: clientId, roles: ["CLIENT_ADMIN"], unitScope: null }, unitIds };
}

function rosterRows(count: number, prefix: string): string[][] {
  return Array.from({ length: count }, (_, i) => [
    `Responden ${prefix} ${i + 1}`,
    `${prefix}-${String(i + 1).padStart(5, "0")}`,
    i % 3 === 0 ? "" : `r${i + 1}.${prefix}@contoh.test`,
    i % 2 === 0 ? `0812${String(10_000_000 + i)}` : "",
    UNIT_NAMES[i % UNIT_NAMES.length] as string,
    `S${(i % 5) + 1}`,
    i % 5 === 4 ? "Ya" : "Tidak",
  ]);
}

const HEADER = ["Nama", "Nomor induk", "Surel", "Telepon", "Unit", "Strata", "Penyedia jasa"];

function csv(rows: string[][]): Uint8Array {
  return new TextEncoder().encode(`﻿${[HEADER, ...rows].map((r) => r.join(";")).join("\r\n")}\r\n`);
}

async function xlsx(rows: string[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Daftar responden");
  ws.addRow(HEADER);
  for (const r of rows) ws.addRow(r);
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

function captureMail() {
  const sent: MailMessage[] = [];
  return { sent, deps: { send: async (m: MailMessage) => void sent.push(m), baseUrl: "https://nscas.contoh.test" } };
}

beforeAll(async () => {
  const operator =
    (await db.organization.findFirst({ where: { isOperator: true } })) ??
    (await db.organization.create({ data: { ...OPERATOR_ORGANIZATION, isOperator: true } }));
  const client = await db.organization.create({ data: { name: `PT Uji M2 ${suffix}`, legalName: `PT Uji M2 ${suffix}` } });
  clientId = client.id;
  const user = await db.user.create({ data: { email: `lead-m2-${suffix}@contoh.test`, name: "Asesor Utama M2", passwordHash: "x" } });
  await db.membership.create({ data: { userId: user.id, organizationId: operator.id, role: "LEAD_ASSESSOR" } });
  const files = loadSeedFiles(SEED_DIR);
  const { _catatan, ...defaults } = files.parameters as Record<string, unknown>;
  void _catatan;
  versionId = (await db.instrumentVersion.create({ data: { code: `TEST-M2-${suffix}`, status: "PUBLISHED", defaultParameters: defaults as never } })).id;
  session = { user: { id: user.id } } as never;
});

afterAll(async () => {
  await stopBoss();
  await db.$disconnect();
});

describe("impor daftar responden", () => {
  it("3.000 baris CSV: pratinjau tidak menyimpan, impor selesai di bawah 30 detik, kontak terenkripsi", async () => {
    const { actor } = await setupAssessment("csv");
    const bytes = csv(rosterRows(3000, "C"));

    const preview = await respondents.importRoster(actor, bytes, false, meta);
    expect(preview).toMatchObject({ ok: true, imported: 0 });
    expect(await db.rosterEntry.count({ where: { assessmentId: actor.assessmentId } })).toBe(0);

    const started = performance.now();
    const result = await respondents.importRoster(actor, bytes, true, meta);
    const seconds = (performance.now() - started) / 1000;
    console.info(`Impor 3.000 baris CSV: ${seconds.toFixed(2)} detik`);
    expect(seconds).toBeLessThan(30);
    expect(result).toMatchObject({ ok: true, imported: 3000 });
    if (!result.ok) return;
    expect(result.summary.byUnit).toHaveLength(12);
    expect(result.summary.byStratum.map((s) => [s.code, s.count])).toEqual([
      ["S1", 600],
      ["S2", 600],
      ["S3", 600],
      ["S4", 600],
      ["S5", 600],
    ]);

    const entries = await db.rosterEntry.findMany({ where: { assessmentId: actor.assessmentId }, orderBy: { employeeNo: "asc" }, take: 3 });
    const [first, second] = entries as [(typeof entries)[0], (typeof entries)[0]];
    expect(first.emailEnc).toBeNull();
    expect(first.phoneEnc).toMatch(/^v1\./);
    expect(respondents.decryptRosterPhone(first)).toBe("+62812" + "10000000");
    expect(second.emailEnc).toMatch(/^v1\./);
    expect(second.emailEnc).not.toContain("contoh.test");
    expect(respondents.decryptRosterEmail(second)).toBe("r2.c@contoh.test");

    const audit = await db.auditLog.findFirstOrThrow({ where: { assessmentId: actor.assessmentId, action: "roster.import" } });
    expect(audit.after).toMatchObject({ imported: 3000, withEmail: 2000 });
    expect(JSON.stringify(audit.after)).not.toMatch(/contoh\.test|Responden/);

    // Impor ulang berkas yang sama ditolak seluruhnya karena nomor induk dan surel sudah terdaftar.
    const again = await respondents.importRoster(actor, bytes, true, meta);
    expect(again).toMatchObject({ ok: false, error: "INVALID_ROWS" });
    if (again.ok || again.error !== "INVALID_ROWS") return;
    expect(again.summary.validation.errors.filter((e) => e.code === "ALREADY_REGISTERED")).toHaveLength(3000 + 2000);
    expect(await db.rosterEntry.count({ where: { assessmentId: actor.assessmentId } })).toBe(3000);
  });

  it("3.000 baris Excel selesai di bawah 30 detik", async () => {
    const { actor } = await setupAssessment("xlsx");
    const bytes = await xlsx(rosterRows(3000, "X"));
    const started = performance.now();
    const result = await respondents.importRoster(actor, bytes, true, meta);
    const seconds = (performance.now() - started) / 1000;
    console.info(`Impor 3.000 baris Excel: ${seconds.toFixed(2)} detik`);
    expect(seconds).toBeLessThan(30);
    expect(result).toMatchObject({ ok: true, imported: 3000 });
  });

  it("satu baris bergalat menggagalkan seluruh impor dan galatnya dilaporkan per baris", async () => {
    const { actor } = await setupAssessment("galat");
    const rows = rosterRows(10, "G");
    (rows[4] as string[])[4] = "Unit Tidak Ada";
    const result = await respondents.importRoster(actor, csv(rows), true, meta);
    expect(result).toMatchObject({ ok: false, error: "INVALID_ROWS" });
    if (result.ok || result.error !== "INVALID_ROWS") return;
    expect(result.summary.validation.errors).toEqual([{ rowNumber: 6, column: "unit", code: "UNIT_NOT_FOUND" }]);
    expect(await db.rosterEntry.count({ where: { assessmentId: actor.assessmentId } })).toBe(0);
  });

  it("koordinator unit hanya dapat mengimpor unitnya, dan impor ditolak sebelum dikunci", async () => {
    const { actor, unitIds } = await setupAssessment("cakupan");
    const coordinator = { ...actor, roles: ["UNIT_COORDINATOR" as const], unitScope: [unitIds[0] as string] };
    const result = await respondents.importRoster(coordinator, csv(rosterRows(2, "U")), true, meta);
    expect(result).toMatchObject({ ok: false, error: "INVALID_ROWS" });
    if (!result.ok && result.error === "INVALID_ROWS") {
      expect(result.summary.validation.errors).toEqual([{ rowNumber: 3, column: "unit", code: "UNIT_OUT_OF_SCOPE" }]);
    }
    await db.assessment.update({ where: { id: actor.assessmentId }, data: { status: "CONFIGURED" } });
    await rejects(respondents.importRoster(actor, csv(rosterRows(1, "U")), true, meta), 409, "DISTRIBUTION_CLOSED");
  });

  it("menolak berkas yang bukan Excel atau CSV", async () => {
    const { actor } = await setupAssessment("format");
    expect(await respondents.importRoster(actor, new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2]), true, meta)).toEqual({ ok: false, error: "FILE_TYPE" });
  });
});

describe("token, undangan, pencabutan, dan penerbitan ulang", () => {
  let actor: RespondentActor;
  let unitIds: string[];

  beforeAll(async () => {
    ({ actor, unitIds } = await setupAssessment("token"));
    const result = await respondents.importRoster(actor, csv(rosterRows(30, "T")), true, meta);
    expect(result).toMatchObject({ ok: true, imported: 30 });
  });

  it("tautan hanya diterbitkan sekali per responden dan basis data hanya menyimpan hash", async () => {
    const links = await respondents.issueSurveyLinks(actor, { unitId: null, onlyWithoutEmail: true }, meta);
    expect(links).toHaveLength(10);
    for (const l of links) expect(l.link).toMatch(/^https:\/\/nscas\.contoh\.test\/s\/[A-Za-z0-9_-]{43}$/);
    const raw = tokenFrom(links[0]?.link as string);
    const stored = await db.accessToken.findUniqueOrThrow({ where: { tokenHash: sha256(raw) } });
    expect(stored).toMatchObject({ kind: "SURVEY", channel: "LINK", revokedAt: null });
    expect(JSON.stringify(stored)).not.toContain(raw);
    const audit = await db.auditLog.findMany({ where: { assessmentId: actor.assessmentId, action: "token.issue" } });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0])).not.toContain(raw);

    expect(await respondents.issueSurveyLinks(actor, { unitId: null, onlyWithoutEmail: true }, meta)).toEqual([]);
  });

  it("koordinator unit tidak dapat menerbitkan untuk unit lain", async () => {
    const coordinator = { ...actor, unitScope: [unitIds[0] as string] };
    await rejects(respondents.issueSurveyLinks(coordinator, { unitId: unitIds[1] as string, onlyWithoutEmail: false }, meta), 403, "FORBIDDEN");
  });

  it("undangan diantre dalam transaksi, lalu worker membuat token saat surel dikirim", async () => {
    const queued = await respondents.queueInvitations(actor, { unitId: null }, meta);
    expect(queued).toBe(20);
    const jobs = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pgboss.job WHERE name = 'invitations.send' AND singleton_key LIKE 'invite:%'`;
    expect(Number(jobs[0]?.n)).toBeGreaterThanOrEqual(20);

    const entry = await db.rosterEntry.findFirstOrThrow({ where: { assessmentId: actor.assessmentId, emailEnc: { not: null } }, orderBy: { employeeNo: "asc" } });
    const { sent, deps } = captureMail();
    expect(await deliverInvitation({ assessmentId: actor.assessmentId, rosterEntryId: entry.id }, deps)).toBe("SENT");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(respondents.decryptRosterEmail(entry));
    const link = sent[0]?.text.match(/https:\/\/nscas\.contoh\.test\/s\/[A-Za-z0-9_-]{43}/)?.[0] as string;
    const token = await db.accessToken.findUniqueOrThrow({ where: { tokenHash: sha256(tokenFrom(link)) } });
    expect(token).toMatchObject({ rosterEntryId: entry.id, channel: "EMAIL", revokedAt: null });

    // Pekerjaan yang terulang tidak membuat token kedua.
    expect(await deliverInvitation({ assessmentId: actor.assessmentId, rosterEntryId: entry.id }, deps)).toBe("SKIPPED");
    expect(sent).toHaveLength(1);
  });

  it("pengiriman yang gagal mencabut tokennya sehingga pengulangan memakai token baru", async () => {
    const entry = await db.rosterEntry.findFirstOrThrow({
      where: { assessmentId: actor.assessmentId, emailEnc: { not: null }, accessTokens: { none: {} } },
    });
    const failing = { send: async () => Promise.reject(new Error("SMTP down")), baseUrl: "https://nscas.contoh.test" };
    await expect(deliverInvitation({ assessmentId: actor.assessmentId, rosterEntryId: entry.id }, failing)).rejects.toThrow("SMTP down");
    const failed = await db.accessToken.findFirstOrThrow({ where: { rosterEntryId: entry.id } });
    expect(failed).toMatchObject({ revokedReason: "SEND_FAILED" });
    expect(failed.revokedAt).not.toBeNull();

    const { sent, deps } = captureMail();
    expect(await deliverInvitation({ assessmentId: actor.assessmentId, rosterEntryId: entry.id }, deps)).toBe("SENT");
    expect(sent).toHaveLength(1);
    expect(await db.accessToken.count({ where: { rosterEntryId: entry.id, revokedAt: null } })).toBe(1);
  });

  it.skipIf(!mailpitAvailable)("surel undangan sampai di Mailpit", async () => {
    const entry = await db.rosterEntry.findFirstOrThrow({
      where: { assessmentId: actor.assessmentId, emailEnc: { not: null }, accessTokens: { none: {} } },
    });
    const to = respondents.decryptRosterEmail(entry) as string;
    expect(await deliverInvitation({ assessmentId: actor.assessmentId, rosterEntryId: entry.id }, { send: (await import("@/lib/mail")).sendMail, baseUrl: "https://nscas.contoh.test" })).toBe("SENT");
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json() as Promise<{ messages: { ID: string; Subject: string }[] }>);
    expect(search.messages[0]?.Subject).toBe(`Undangan survei budaya keselamatan dan kesehatan kerja PT Uji M2 ${suffix}`);
  });

  it("mencabut token aktif, menerbitkan ulang tautan, dan menolak penerbitan ulang setelah selesai", async () => {
    const entry = await db.rosterEntry.findFirstOrThrow({ where: { assessmentId: actor.assessmentId, emailEnc: null }, include: { accessTokens: true } });
    const original = entry.accessTokens[0];
    await respondents.revokeSurveyToken(actor, entry.id, meta);
    expect(await db.accessToken.findUniqueOrThrow({ where: { id: original?.id } })).toMatchObject({ revokedReason: "MANUAL" });
    await rejects(respondents.revokeSurveyToken(actor, entry.id, meta), 422, "NO_ACTIVE_TOKEN");

    const reissued = await respondents.reissueSurveyToken(actor, entry.id, "link", meta);
    const fresh = await db.accessToken.findUniqueOrThrow({ where: { tokenHash: sha256(tokenFrom(reissued?.link as string)) } });
    expect(fresh).toMatchObject({ rosterEntryId: entry.id, revokedAt: null, channel: "LINK" });
    await rejects(respondents.reissueSurveyToken(actor, entry.id, "email", meta), 422, "NO_EMAIL");

    await db.accessToken.update({ where: { id: fresh.id }, data: { completedAt: new Date() } });
    await rejects(respondents.reissueSurveyToken(actor, entry.id, "link", meta), 422, "TOKEN_ALREADY_USED");
    await rejects(respondents.revokeSurveyToken(actor, entry.id, meta), 422, "NO_ACTIVE_TOKEN");
    expect(await db.auditLog.count({ where: { entityId: entry.id, action: { in: ["token.revoke", "token.reissue"] } } })).toBe(2);
  });
});

describe("pengingat terjadwal", () => {
  let actor: RespondentActor;
  const now = new Date();

  beforeAll(async () => {
    ({ actor } = await setupAssessment("pengingat"));
    await respondents.importRoster(actor, csv(rosterRows(6, "R")), true, meta);
    await db.assessment.update({
      where: { id: actor.assessmentId },
      data: { status: "DATA_COLLECTION", surveyOpensAt: new Date(now.getTime() - 10 * DAY), surveyClosesAt: new Date(now.getTime() + 20 * DAY) },
    });
    const { deps } = captureMail();
    const withEmail = await db.rosterEntry.findMany({ where: { assessmentId: actor.assessmentId, emailEnc: { not: null } } });
    for (const e of withEmail) await deliverInvitation({ assessmentId: actor.assessmentId, rosterEntryId: e.id }, deps);
    await respondents.issueSurveyLinks(actor, { unitId: null, onlyWithoutEmail: true }, meta);
    // Undangan dianggap terkirim lima hari lalu.
    await db.accessToken.updateMany({ where: { assessmentId: actor.assessmentId }, data: { issuedAt: new Date(now.getTime() - 5 * DAY) } });
  });

  it("hanya token surel yang belum selesai dan berjarak tiga hari yang diantre", async () => {
    const tokens = await db.accessToken.findMany({ where: { assessmentId: actor.assessmentId, channel: "EMAIL" }, orderBy: { id: "asc" } });
    expect(tokens).toHaveLength(4);
    await db.accessToken.update({ where: { id: tokens[0]?.id }, data: { completedAt: new Date() } });
    await db.accessToken.update({ where: { id: tokens[1]?.id }, data: { lastReminderAt: new Date(now.getTime() - DAY), reminderCount: 1 } });
    expect(await scheduleReminders(now)).toBe(2);
  });

  it("token yang belum dibuka diganti token baru; token lama dicabut setelah surel terkirim", async () => {
    const token = await db.accessToken.findFirstOrThrow({
      where: { assessmentId: actor.assessmentId, channel: "EMAIL", completedAt: null, reminderCount: 0, firstOpenedAt: null },
    });
    const { sent, deps } = captureMail();
    expect(await deliverReminder({ tokenId: token.id }, deps, now)).toBe("SENT");
    expect(sent[0]?.subject).toMatch(/^Pengingat survei/);
    const link = sent[0]?.text.match(/\/s\/([A-Za-z0-9_-]{43})/)?.[1] as string;
    const rotated = await db.accessToken.findUniqueOrThrow({ where: { tokenHash: sha256(link) } });
    expect(rotated).toMatchObject({ rosterEntryId: token.rosterEntryId, reminderCount: 1, revokedAt: null, channel: "EMAIL" });
    expect(await db.accessToken.findUniqueOrThrow({ where: { id: token.id } })).toMatchObject({ revokedReason: "ROTATED_REMINDER" });
    // Pekerjaan yang sama tidak dikirim dua kali.
    expect(await deliverReminder({ tokenId: token.id }, deps, now)).toBe("SKIPPED");
  });

  it("token yang sudah dibuka tidak diganti; surel meminta melanjutkan tanpa tautan", async () => {
    const token = await db.accessToken.findFirstOrThrow({
      where: { assessmentId: actor.assessmentId, channel: "EMAIL", completedAt: null, revokedAt: null, reminderCount: 0 },
    });
    await db.accessToken.update({ where: { id: token.id }, data: { firstOpenedAt: new Date(now.getTime() - 4 * DAY) } });
    const { sent, deps } = captureMail();
    expect(await deliverReminder({ tokenId: token.id }, deps, now)).toBe("SENT");
    expect(sent[0]?.subject).toMatch(/^Lanjutkan survei/);
    expect(sent[0]?.text).not.toContain("/s/");
    expect(await db.accessToken.findUniqueOrThrow({ where: { id: token.id } })).toMatchObject({ reminderCount: 1, revokedAt: null });
  });

  it("paling banyak tiga pengingat, dan tidak ada pengingat di luar jendela survei", async () => {
    const token = await db.accessToken.findFirstOrThrow({ where: { assessmentId: actor.assessmentId, channel: "EMAIL", completedAt: null, revokedAt: null } });
    await db.accessToken.update({ where: { id: token.id }, data: { reminderCount: MAX_REMINDERS, lastReminderAt: new Date(now.getTime() - 10 * DAY) } });
    const { deps } = captureMail();
    expect(await deliverReminder({ tokenId: token.id }, deps, now)).toBe("SKIPPED");

    await db.accessToken.updateMany({ where: { assessmentId: actor.assessmentId }, data: { reminderCount: 0, lastReminderAt: null } });
    expect(await scheduleReminders(new Date(now.getTime() + 21 * DAY))).toBe(0);
  });
});

describe("kode QR unit", () => {
  let actor: RespondentActor;
  let unitIds: string[];

  beforeAll(async () => {
    ({ actor, unitIds } = await setupAssessment("qr"));
  });

  it("menerbitkan token sekali pakai hanya saat pengumpulan data dan jendela terbuka, dengan batas penerbitan", async () => {
    const qr = await respondents.createUnitQrCode(actor, { unitId: unitIds[2] as string, maxIssuance: 2 }, meta);
    const code = tokenFrom(qr.link);
    expect(qr.link).toMatch(/\/q\/[A-Za-z0-9_-]{43}$/);
    expect(await db.unitQrCode.count({ where: { codeHash: sha256(code) } })).toBe(1);

    expect(await respondents.issueTokenFromQr(code, null)).toEqual({ ok: false, reason: "CLOSED" });
    await db.assessment.update({
      where: { id: actor.assessmentId },
      data: { status: "DATA_COLLECTION", surveyOpensAt: new Date(Date.now() - DAY), surveyClosesAt: new Date(Date.now() + DAY) },
    });

    const first = await respondents.issueTokenFromQr(code, null);
    expect(first).toMatchObject({ ok: true, reused: false });
    if (!first.ok) return;
    const token = await db.accessToken.findUniqueOrThrow({ where: { tokenHash: sha256(first.raw) } });
    expect(token).toMatchObject({ rosterEntryId: null, stratumId: null, unitId: unitIds[2], channel: "QR" });

    // Perangkat yang sama memindai lagi: token yang belum selesai dipakai ulang tanpa menghabiskan kuota.
    expect(await respondents.issueTokenFromQr(code, first.raw)).toMatchObject({ ok: true, raw: first.raw, reused: true });
    expect(await respondents.issueTokenFromQr(code, null)).toMatchObject({ ok: true, reused: false });
    expect(await respondents.issueTokenFromQr(code, null)).toEqual({ ok: false, reason: "LIMIT" });
    expect(await respondents.issueTokenFromQr("x".repeat(43), null)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("membuat kode baru menonaktifkan kode lama unit tersebut", async () => {
    const a = await respondents.createUnitQrCode(actor, { unitId: unitIds[3] as string, maxIssuance: null }, meta);
    const b = await respondents.createUnitQrCode(actor, { unitId: unitIds[3] as string, maxIssuance: null }, meta);
    expect(await respondents.issueTokenFromQr(tokenFrom(a.link), null)).toEqual({ ok: false, reason: "INVALID" });
    expect(await respondents.issueTokenFromQr(tokenFrom(b.link), null)).toMatchObject({ ok: true });
    await respondents.deactivateUnitQrCode(actor, b.id, meta);
    expect(await respondents.issueTokenFromQr(tokenFrom(b.link), null)).toEqual({ ok: false, reason: "INVALID" });
    expect(await db.auditLog.count({ where: { assessmentId: actor.assessmentId, action: { in: ["qr.create", "qr.deactivate"] } } })).toBe(4);
  });
});

describe("partisipasi", () => {
  it("dihitung dari AccessToken.completedAt dengan ambang sel lima dan penanda strata di bawah 30 persen", async () => {
    const { actor } = await setupAssessment("partisipasi");
    await respondents.importRoster(actor, csv(rosterRows(100, "P")), true, meta);
    await respondents.issueSurveyLinks(actor, { unitId: null, onlyWithoutEmail: false }, meta);
    const strata = await db.stratum.findMany({ where: { assessmentId: actor.assessmentId }, orderBy: { code: "asc" } });
    await db.stratum.updateMany({ where: { assessmentId: actor.assessmentId }, data: { population: 40 } });
    // S1: 15 dari 40 selesai (37,5 persen); S2: 3 selesai (disembunyikan); strata lain belum ada.
    for (const [code, n] of [["S1", 15], ["S2", 3]] as const) {
      const stratum = strata.find((s) => s.code === code);
      const tokens = await db.accessToken.findMany({ where: { assessmentId: actor.assessmentId, stratumId: stratum?.id }, take: n, select: { id: true } });
      await db.accessToken.updateMany({ where: { id: { in: tokens.map((t) => t.id) } }, data: { completedAt: new Date() } });
    }
    await db.assessment.update({ where: { id: actor.assessmentId }, data: { status: "DATA_COLLECTION" } });

    const { summary, minCell } = await loadParticipation(actor.assessmentId, null);
    expect(minCell).toBe(5);
    const byCode = Object.fromEntries(summary.strata.map((s) => [s.code, s]));
    expect(byCode.S1).toMatchObject({ population: 40, registered: 20, issued: 20, completed: { value: 15 }, rate: 0.375, belowMinimum: false });
    expect(byCode.S2).toMatchObject({ completed: { value: null, suppressed: true }, rate: null, belowMinimum: true });
    expect(byCode.S3).toMatchObject({ completed: { value: 0 }, rate: 0, belowMinimum: true });
    expect(summary.strataBelowMinimum).toBe(4);
    expect(summary.totals).toMatchObject({ registered: 100, issued: 100, completed: { value: 18 } });

    await takeParticipationSnapshots();
    await takeParticipationSnapshots();
    const snapshots = await db.participationSnapshot.findMany({ where: { assessmentId: actor.assessmentId } });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.takenOn.toISOString().slice(0, 10)).toBe(wibDate(new Date()).toISOString().slice(0, 10));
    expect(snapshots[0]?.data).toMatchObject({ population: 200, issued: 100, completed: 18 });
  });

  it("tanggal cuplikan memakai kalender WIB", () => {
    expect(wibDate(new Date("2026-11-02T16:59:00Z")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(wibDate(new Date("2026-11-02T17:00:00Z")).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });
});
