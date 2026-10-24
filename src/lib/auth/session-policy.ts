// Kebijakan sesi (docs/04 bagian 3): kedaluwarsa 8 jam, atau 30 menit tidak aktif untuk peran Nusa Safety.

export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Waktu aktivitas terakhir diperbarui paling sering sekali per menit agar tidak menulis di setiap permintaan. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
/** Izin sesi dari alur masuk harus ditukar menjadi cookie dalam waktu ini. */
export const SESSION_GRANT_TTL_MS = 60 * 1000;

export type SessionInvalidReason = "REVOKED" | "EXPIRED" | "IDLE_TIMEOUT" | "USER_INACTIVE" | "NOT_BOUND";

export interface SessionState {
  revokedAt: Date | null;
  expiresAt: Date;
  lastActivityAt: Date;
  boundAt: Date | null;
}

export type SessionEvaluation = { valid: true; shouldTouch: boolean } | { valid: false; reason: SessionInvalidReason };

export function evaluateSession(
  session: SessionState,
  user: { isActive: boolean },
  idleTimeoutApplies: boolean,
  now: Date,
): SessionEvaluation {
  if (session.revokedAt) return { valid: false, reason: "REVOKED" };
  if (!session.boundAt) return { valid: false, reason: "NOT_BOUND" };
  if (!user.isActive) return { valid: false, reason: "USER_INACTIVE" };
  if (session.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: "EXPIRED" };
  const idleMs = now.getTime() - session.lastActivityAt.getTime();
  if (idleTimeoutApplies && idleMs > SESSION_IDLE_MS) return { valid: false, reason: "IDLE_TIMEOUT" };
  return { valid: true, shouldTouch: idleMs >= SESSION_TOUCH_INTERVAL_MS };
}
