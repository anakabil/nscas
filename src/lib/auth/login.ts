import "server-only";
import argon2 from "argon2";
import { logAudit, type RequestMeta } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { decryptField, fieldContext, keyedHash } from "@/lib/privacy/crypto";
import { loginRateLimiter } from "@/lib/rate-limit";
import { looksLikeBackupCode, normalizeBackupCode } from "./backup-codes";
import { CLEARED_LOCKOUT, isLocked, registerFailure } from "./lockout";
import { burnPasswordVerification, verifyPassword } from "./passwords";
import { createUserSession, issueSessionGrant } from "./session-store";
import { verifyTotp } from "./totp";

// Alur masuk dua langkah. Semua kegagalan dicatat di jejak audit dan dihitung untuk penguncian akun.

export type LoginErrorCode = "INVALID_CREDENTIALS" | "LOCKED" | "INACTIVE" | "RATE_LIMITED" | "INVALID_CODE" | "EXPIRED";

export type PasswordStepResult =
  | { ok: true; userId: string; secondFactorRequired: boolean }
  | { ok: false; error: LoginErrorCode };

async function recordFailure(userId: string, reason: string, meta: RequestMeta): Promise<"INVALID" | "LOCKED"> {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { failedLoginCount: true, failedLoginWindowStart: true, lockedUntil: true },
    });
    const next = registerFailure(user, new Date());
    await tx.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: next.failedLoginCount,
        failedLoginWindowStart: next.failedLoginWindowStart,
        lockedUntil: next.lockedUntil,
      },
    });
    await logAudit(tx, { action: "auth.login_failed", entityType: "User", entityId: userId, after: { reason }, meta });
    if (next.lockedNow) {
      await logAudit(tx, {
        action: "auth.account_locked",
        entityType: "User",
        entityId: userId,
        after: { lockedUntil: next.lockedUntil?.toISOString() },
        meta,
      });
      return "LOCKED";
    }
    return "INVALID";
  });
}

/** Langkah pertama: surel dan kata sandi. */
export async function verifyPasswordStep(emailInput: string, password: string, meta: RequestMeta): Promise<PasswordStepResult> {
  const email = emailInput.trim().toLowerCase();
  // docs/04 bagian 5: 10 percobaan masuk per menit per akun. Kunci berupa hash agar surel tidak tersimpan di memori.
  if (!loginRateLimiter.consume(keyedHash(email, "login-rate")).allowed) return { ok: false, error: "RATE_LIMITED" };

  const db = getDb();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isActive: true, totpEnabled: true, lockedUntil: true },
  });

  if (!user) {
    await burnPasswordVerification(password);
    await db.$transaction((tx) =>
      logAudit(tx, { action: "auth.login_failed", entityType: "User", after: { reason: "UNKNOWN_ACCOUNT" }, meta }),
    );
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  // Selama terkunci, kata sandi tidak diperiksa sama sekali agar tebakan tidak dapat dilanjutkan.
  if (isLocked(user, new Date())) {
    await db.$transaction((tx) =>
      logAudit(tx, { action: "auth.login_failed", entityType: "User", entityId: user.id, after: { reason: "LOCKED" }, meta }),
    );
    return { ok: false, error: "LOCKED" };
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    const outcome = await recordFailure(user.id, "INVALID_PASSWORD", meta);
    return { ok: false, error: outcome === "LOCKED" ? "LOCKED" : "INVALID_CREDENTIALS" };
  }

  if (!user.isActive) {
    await db.$transaction((tx) =>
      logAudit(tx, { action: "auth.login_failed", entityType: "User", entityId: user.id, after: { reason: "INACTIVE" }, meta }),
    );
    return { ok: false, error: "INACTIVE" };
  }

  return { ok: true, userId: user.id, secondFactorRequired: user.totpEnabled };
}

/** Langkah kedua: kode dari aplikasi autentikator atau salah satu kode cadangan. */
export async function verifySecondFactorStep(
  userId: string,
  code: string,
  meta: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: LoginErrorCode }> {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, lockedUntil: true, totpEnabled: true, totpSecretEnc: true, totpLastUsedStep: true },
  });
  if (!user || !user.isActive || !user.totpEnabled || !user.totpSecretEnc) return { ok: false, error: "EXPIRED" };
  if (isLocked(user, new Date())) return { ok: false, error: "LOCKED" };

  if (looksLikeBackupCode(code)) {
    const normalized = normalizeBackupCode(code);
    const unused = await db.backupCode.findMany({ where: { userId, usedAt: null }, select: { id: true, codeHash: true } });
    for (const candidate of unused) {
      if (await argon2.verify(candidate.codeHash, normalized)) {
        const consumed = await db.$transaction(async (tx) => {
          // updateMany dengan usedAt: null mencegah satu kode dipakai dua kali secara bersamaan.
          const used = await tx.backupCode.updateMany({ where: { id: candidate.id, usedAt: null }, data: { usedAt: new Date() } });
          if (used.count !== 1) return false;
          const remaining = await tx.backupCode.count({ where: { userId, usedAt: null } });
          await logAudit(tx, { action: "auth.backup_code_used", entityType: "User", entityId: userId, after: { remaining }, meta });
          return true;
        });
        if (consumed) return { ok: true };
      }
    }
  } else {
    const secret = decryptField(user.totpSecretEnc, fieldContext("User", "totpSecretEnc", user.id));
    const result = verifyTotp(secret, code, user.totpLastUsedStep);
    if (result.valid) {
      // Hanya diterima bila langkah waktu lebih baru dari yang tersimpan, sehingga kode tidak dapat dipakai ulang.
      const updated = await db.user.updateMany({
        where: { id: userId, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: result.timeStep } }] },
        data: { totpLastUsedStep: result.timeStep },
      });
      if (updated.count === 1) return { ok: true };
    }
  }

  const outcome = await recordFailure(userId, "INVALID_SECOND_FACTOR", meta);
  return { ok: false, error: outcome === "LOCKED" ? "LOCKED" : "INVALID_CODE" };
}

/** Menyelesaikan alur masuk: membuka penguncian, membuat sesi di server, mencatat audit, dan mengembalikan izin sesi. */
export async function completeLogin(
  userId: string,
  options: { totpVerified: boolean; meta: RequestMeta },
): Promise<string> {
  const db = getDb();
  const now = new Date();
  const session = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { ...CLEARED_LOCKOUT, lastLoginAt: now } });
    const created = await createUserSession(tx, { userId, totpVerified: options.totpVerified, meta: options.meta, now });
    await logAudit(tx, {
      action: "auth.login",
      entityType: "User",
      entityId: userId,
      actor: { id: userId },
      after: { sessionId: created.id, secondFactor: options.totpVerified },
      meta: options.meta,
    });
    return created;
  });
  return issueSessionGrant(session.id);
}
