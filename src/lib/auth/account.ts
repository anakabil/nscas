import "server-only";
import argon2 from "argon2";
import QRCode from "qrcode";
import { logAudit, type RequestMeta } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { decryptField, encryptField, fieldContext } from "@/lib/privacy/crypto";
import { generateBackupCodes, normalizeBackupCode } from "./backup-codes";
import { hashPassword, passwordSchema, verifyPassword } from "./passwords";
import type { SessionContext } from "./session";
import { revokeUserSessions } from "./session-store";
import { createTotpSecret, totpUri, verifyTotp } from "./totp";

// Pengaturan akun milik pengguna sendiri: TOTP, kode cadangan, kata sandi, dan keluar.

const totpContext = (userId: string) => fieldContext("User", "totpSecretEnc", userId);

async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => argon2.hash(normalizeBackupCode(c), { type: argon2.argon2id })));
}

export interface TotpEnrollment {
  secret: string;
  qrDataUrl: string;
}

/** Rahasia TOTP yang sedang menunggu konfirmasi; dibuat bila belum ada. */
export async function getOrCreateTotpEnrollment(session: SessionContext): Promise<TotpEnrollment | null> {
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, email: true, totpEnabled: true, totpSecretEnc: true },
  });
  if (user.totpEnabled) return null;

  let secret: string;
  if (user.totpSecretEnc) {
    secret = decryptField(user.totpSecretEnc, totpContext(user.id));
  } else {
    secret = createTotpSecret();
    await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: encryptField(secret, totpContext(user.id)) } });
  }
  const qrDataUrl = await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 220 });
  return { secret, qrDataUrl };
}

export type AccountResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Mengaktifkan TOTP setelah kode pertama benar, lalu menerbitkan 10 kode cadangan (ditampilkan sekali). */
export async function confirmTotpEnrollment(
  session: SessionContext,
  code: string,
  meta: RequestMeta,
): Promise<AccountResult<{ backupCodes: string[] }>> {
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, totpEnabled: true, totpSecretEnc: true },
  });
  if (user.totpEnabled) return { ok: false, error: "ALREADY_ENABLED" };
  if (!user.totpSecretEnc) return { ok: false, error: "NOT_STARTED" };

  const result = verifyTotp(decryptField(user.totpSecretEnc, totpContext(user.id)), code, null);
  if (!result.valid) return { ok: false, error: "INVALID_CODE" };

  const backupCodes = generateBackupCodes();
  const hashes = await hashBackupCodes(backupCodes);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { totpEnabled: true, totpEnabledAt: new Date(), totpLastUsedStep: result.timeStep },
    });
    await tx.backupCode.deleteMany({ where: { userId: user.id } });
    await tx.backupCode.createMany({ data: hashes.map((codeHash) => ({ userId: user.id, codeHash })) });
    await tx.userSession.update({ where: { id: session.sessionId }, data: { totpVerified: true } });
    const revoked = await revokeUserSessions(tx, user.id, "TOTP_ENABLED", { exceptSessionId: session.sessionId });
    await logAudit(tx, {
      action: "auth.totp_enabled",
      entityType: "User",
      entityId: user.id,
      actor: { id: user.id },
      after: { backupCodesIssued: backupCodes.length, otherSessionsRevoked: revoked },
      meta,
    });
  });
  return { ok: true, data: { backupCodes } };
}

/** Mengganti seluruh kode cadangan. Memerlukan kode dari aplikasi autentikator. */
export async function regenerateBackupCodes(
  session: SessionContext,
  code: string,
  meta: RequestMeta,
): Promise<AccountResult<{ backupCodes: string[] }>> {
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, totpEnabled: true, totpSecretEnc: true, totpLastUsedStep: true },
  });
  if (!user.totpEnabled || !user.totpSecretEnc) return { ok: false, error: "NOT_ENABLED" };

  const result = verifyTotp(decryptField(user.totpSecretEnc, totpContext(user.id)), code, user.totpLastUsedStep);
  if (!result.valid) return { ok: false, error: "INVALID_CODE" };

  const backupCodes = generateBackupCodes();
  const hashes = await hashBackupCodes(backupCodes);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { totpLastUsedStep: result.timeStep } });
    await tx.backupCode.deleteMany({ where: { userId: user.id } });
    await tx.backupCode.createMany({ data: hashes.map((codeHash) => ({ userId: user.id, codeHash })) });
    await logAudit(tx, {
      action: "auth.backup_codes_regenerated",
      entityType: "User",
      entityId: user.id,
      actor: { id: user.id },
      after: { backupCodesIssued: backupCodes.length },
      meta,
    });
  });
  return { ok: true, data: { backupCodes } };
}

export async function countUnusedBackupCodes(userId: string): Promise<number> {
  return getDb().backupCode.count({ where: { userId, usedAt: null } });
}

/** Mengganti kata sandi sendiri. Sesi lain dicabut. */
export async function changeOwnPassword(
  session: SessionContext,
  input: { currentPassword: string; newPassword: string },
  meta: RequestMeta,
): Promise<AccountResult> {
  if (!passwordSchema.safeParse(input.newPassword).success) return { ok: false, error: "WEAK_PASSWORD" };
  if (input.newPassword === input.currentPassword) return { ok: false, error: "SAME_PASSWORD" };

  const db = getDb();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) return { ok: false, error: "WRONG_PASSWORD" };

  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
    });
    const revoked = await revokeUserSessions(tx, user.id, "PASSWORD_CHANGED", { exceptSessionId: session.sessionId });
    await logAudit(tx, {
      action: "auth.password_changed",
      entityType: "User",
      entityId: user.id,
      actor: { id: user.id },
      after: { otherSessionsRevoked: revoked },
      meta,
    });
  });
  return { ok: true, data: undefined };
}

export async function logoutSession(session: SessionContext, meta: RequestMeta): Promise<void> {
  const db = getDb();
  await db.$transaction(async (tx) => {
    await tx.userSession.update({
      where: { id: session.sessionId },
      data: { revokedAt: new Date(), revokedReason: "LOGOUT" },
    });
    await logAudit(tx, {
      action: "auth.logout",
      entityType: "User",
      entityId: session.user.id,
      actor: { id: session.user.id },
      after: { sessionId: session.sessionId },
      meta,
    });
  });
}
