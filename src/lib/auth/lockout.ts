// Penguncian akun: 5 kali gagal masuk dalam 15 menit (docs/04 bagian 3).
// Lama penguncian 15 menit; SUPER_ADMIN atau CLIENT_ADMIN dapat membukanya lebih awal.

export const LOCKOUT_MAX_FAILURES = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export interface LockoutState {
  failedLoginCount: number;
  failedLoginWindowStart: Date | null;
  lockedUntil: Date | null;
}

export function isLocked(state: Pick<LockoutState, "lockedUntil">, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** Keadaan baru setelah satu kegagalan. Jendela 15 menit dimulai dari kegagalan pertama. */
export function registerFailure(state: LockoutState, now: Date): LockoutState & { lockedNow: boolean } {
  const windowExpired =
    state.failedLoginWindowStart === null ||
    now.getTime() - state.failedLoginWindowStart.getTime() > LOCKOUT_WINDOW_MS;
  const failedLoginCount = windowExpired ? 1 : state.failedLoginCount + 1;
  const failedLoginWindowStart = windowExpired ? now : state.failedLoginWindowStart;
  const lockedNow = failedLoginCount >= LOCKOUT_MAX_FAILURES;
  return {
    failedLoginCount: lockedNow ? 0 : failedLoginCount,
    failedLoginWindowStart: lockedNow ? null : failedLoginWindowStart,
    lockedUntil: lockedNow ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : state.lockedUntil,
    lockedNow,
  };
}

export const CLEARED_LOCKOUT: LockoutState = {
  failedLoginCount: 0,
  failedLoginWindowStart: null,
  lockedUntil: null,
};
