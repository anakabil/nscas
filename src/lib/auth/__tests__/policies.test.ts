// Penguncian akun, kebijakan sesi, TOTP, kode cadangan, kata sandi sementara, dan pembatas laju.

import { generateSecret, generateSync } from "otplib";
import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "@/lib/rate-limit";
import { BACKUP_CODE_ALPHABET, generateBackupCodes, looksLikeBackupCode, normalizeBackupCode } from "../backup-codes";
import { CLEARED_LOCKOUT, isLocked, LOCKOUT_DURATION_MS, registerFailure, type LockoutState } from "../lockout";
import { generateTemporaryPassword } from "../passwords";
import { evaluateSession, SESSION_IDLE_MS } from "../session-policy";
import { verifyTotp } from "../totp";

const MIN = 60 * 1000;
const t0 = new Date("2026-10-24T01:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("penguncian akun: 5 kali gagal dalam 15 menit", () => {
  it("terkunci pada kegagalan kelima dalam jendela 15 menit, selama 15 menit", () => {
    let state: LockoutState = CLEARED_LOCKOUT;
    for (let i = 1; i <= 4; i++) {
      const next = registerFailure(state, at(i * MIN));
      expect(next.lockedNow, `kegagalan ${i}`).toBe(false);
      state = next;
    }
    const fifth = registerFailure(state, at(5 * MIN));
    expect(fifth.lockedNow).toBe(true);
    expect(fifth.lockedUntil?.getTime()).toBe(at(5 * MIN).getTime() + LOCKOUT_DURATION_MS);
    expect(isLocked(fifth, at(19 * MIN))).toBe(true);
    expect(isLocked(fifth, at(20 * MIN + 1))).toBe(false);
  });

  it("jendela dimulai ulang bila kegagalan berikutnya lebih dari 15 menit setelah kegagalan pertama", () => {
    let state: LockoutState = CLEARED_LOCKOUT;
    for (let i = 0; i < 4; i++) state = registerFailure(state, at(i * MIN));
    // Kegagalan kelima pada menit ke-16: jendela kegagalan pertama (menit 0) sudah lewat.
    const late = registerFailure(state, at(16 * MIN));
    expect(late.lockedNow).toBe(false);
    expect(late.failedLoginCount).toBe(1);
  });
});

describe("kebijakan sesi", () => {
  const fresh = { revokedAt: null, boundAt: t0, expiresAt: at(8 * 60 * MIN), lastActivityAt: t0 };
  const active = { isActive: true };

  it("berakhir setelah 8 jam untuk semua peran", () => {
    expect(evaluateSession({ ...fresh, lastActivityAt: at(8 * 60 * MIN - MIN) }, active, false, at(8 * 60 * MIN))).toEqual({
      valid: false,
      reason: "EXPIRED",
    });
  });

  it("berakhir setelah 30 menit tidak aktif hanya untuk peran Nusa Safety", () => {
    const later = at(SESSION_IDLE_MS + 1);
    expect(evaluateSession(fresh, active, true, later)).toEqual({ valid: false, reason: "IDLE_TIMEOUT" });
    expect(evaluateSession(fresh, active, false, later)).toEqual({ valid: true, shouldTouch: true });
    expect(evaluateSession(fresh, active, true, at(SESSION_IDLE_MS))).toEqual({ valid: true, shouldTouch: true });
  });

  it("ditolak bila dicabut, belum ditukar, atau pengguna dinonaktifkan", () => {
    expect(evaluateSession({ ...fresh, revokedAt: t0 }, active, false, t0)).toEqual({ valid: false, reason: "REVOKED" });
    expect(evaluateSession({ ...fresh, boundAt: null }, active, false, t0)).toEqual({ valid: false, reason: "NOT_BOUND" });
    expect(evaluateSession(fresh, { isActive: false }, false, t0)).toEqual({ valid: false, reason: "USER_INACTIVE" });
  });

  it("waktu aktivitas diperbarui paling sering sekali per menit", () => {
    expect(evaluateSession(fresh, active, true, at(30 * 1000))).toEqual({ valid: true, shouldTouch: false });
    expect(evaluateSession(fresh, active, true, at(MIN))).toEqual({ valid: true, shouldTouch: true });
  });
});

describe("TOTP", () => {
  const secret = generateSecret();
  const epoch = Math.floor(t0.getTime() / 1000);
  const code = generateSync({ secret, epoch });

  it("menerima kode langkah waktu sekarang dan satu langkah sebelum atau sesudahnya", () => {
    expect(verifyTotp(secret, code, null, t0.getTime())).toMatchObject({ valid: true });
    expect(verifyTotp(secret, code, null, t0.getTime() + 30_000)).toMatchObject({ valid: true });
    expect(verifyTotp(secret, generateSync({ secret, epoch: epoch + 30 }), null, t0.getTime())).toMatchObject({ valid: true });
  });

  it("menolak kode yang sudah dipakai (langkah waktu tidak lebih baru)", () => {
    const first = verifyTotp(secret, code, null, t0.getTime());
    expect(first.valid).toBe(true);
    if (first.valid) expect(verifyTotp(secret, code, first.timeStep, t0.getTime())).toEqual({ valid: false });
  });

  it("menolak kode kedaluwarsa, salah, atau bukan enam digit", () => {
    expect(verifyTotp(secret, code, null, t0.getTime() + 5 * MIN)).toEqual({ valid: false });
    expect(verifyTotp(secret, code === "000000" ? "111111" : "000000", null, t0.getTime())).toEqual({ valid: false });
    expect(verifyTotp(secret, "12345", null, t0.getTime())).toEqual({ valid: false });
    expect(verifyTotp(secret, "abcdef", null, t0.getTime())).toEqual({ valid: false });
  });

  it("mengabaikan spasi di dalam kode", () => {
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, null, t0.getTime())).toMatchObject({ valid: true });
  });
});

describe("kode cadangan", () => {
  it("alfabet berisi tepat 32 simbol unik tanpa I, O, 0, dan 1", () => {
    expect(new Set(BACKUP_CODE_ALPHABET).size).toBe(32);
    expect(BACKUP_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("sepuluh kode unik berformat XXXXX-XXXXX", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      expect(looksLikeBackupCode(c)).toBe(true);
    }
  });

  it("normalisasi mengabaikan huruf kecil, spasi, dan tanda hubung; kode TOTP tidak dianggap kode cadangan", () => {
    expect(normalizeBackupCode("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(looksLikeBackupCode("abcde fghjk")).toBe(true);
    expect(looksLikeBackupCode("123456")).toBe(false);
    expect(looksLikeBackupCode("ABCDE-FGHJ0")).toBe(false);
  });
});

describe("kata sandi sementara", () => {
  it("16 karakter dari alfabet tanpa karakter yang mudah tertukar, dan acak", () => {
    const a = generateTemporaryPassword();
    expect(a).toHaveLength(16);
    expect(a).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{16}$/);
    expect(a).not.toBe(generateTemporaryPassword());
  });
});

describe("pembatas laju", () => {
  it("10 per menit per kunci, lalu menolak sampai jendela berganti", () => {
    const limiter = new FixedWindowRateLimiter(10, MIN);
    for (let i = 0; i < 10; i++) expect(limiter.consume("akun-a", 0).allowed).toBe(true);
    const blocked = limiter.consume("akun-a", 1_000);
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfterMs: MIN - 1_000 });
    expect(limiter.consume("akun-b", 1_000).allowed).toBe(true);
    expect(limiter.consume("akun-a", MIN).allowed).toBe(true);
  });

  it("memori terbatas: entri kedaluwarsa dan tertua dibuang bila penuh", () => {
    const limiter = new FixedWindowRateLimiter(1, MIN, 3);
    for (const k of ["a", "b", "c", "d"]) limiter.consume(k, 0);
    expect(limiter.consume("d", 1).allowed).toBe(false);
    expect(limiter.consume("a", 1).allowed).toBe(true); // "a" sudah dibuang
  });
});
