// TOTP (RFC 6238) dengan otplib: 6 digit, periode 30 detik, toleransi satu langkah.
// Kode yang sudah diterima tidak dapat dipakai ulang (afterTimeStep).

import { generateSecret, generateURI, verifySync } from "otplib";

export const TOTP_ISSUER = "NSCAS Nusa Safety";
const PERIOD_SECONDS = 30;

export function createTotpSecret(): string {
  return generateSecret();
}

export function totpUri(secret: string, accountLabel: string): string {
  return generateURI({ issuer: TOTP_ISSUER, label: accountLabel, secret });
}

export function normalizeTotpCode(input: string): string {
  return input.replace(/\s+/g, "");
}

export function looksLikeTotpCode(input: string): boolean {
  return /^\d{6}$/.test(normalizeTotpCode(input));
}

export type TotpVerification = { valid: true; timeStep: number } | { valid: false };

export function verifyTotp(
  secret: string,
  input: string,
  lastUsedStep: number | null,
  now: number = Date.now(),
): TotpVerification {
  const token = normalizeTotpCode(input);
  if (!looksLikeTotpCode(token)) return { valid: false };
  const result = verifySync({
    secret,
    token,
    epoch: Math.floor(now / 1000),
    epochTolerance: PERIOD_SECONDS,
    ...(lastUsedStep !== null ? { afterTimeStep: lastUsedStep } : {}),
  });
  // Hasil verifikasi otplib bertipe gabungan TOTP dan HOTP; hanya hasil TOTP yang memuat timeStep.
  if (!result.valid || !("timeStep" in result) || typeof result.timeStep !== "number") return { valid: false };
  return { valid: true, timeStep: result.timeStep };
}
