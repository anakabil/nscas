// Kode cadangan TOTP: 10 kode sekali pakai, masing-masing 10 karakter (50 bit) dari alfabet tanpa
// karakter yang mudah tertukar (I, O, 0, 1). Disimpan sebagai hash argon2id, ditampilkan sekali.

import { randomBytes } from "node:crypto";

export const BACKUP_CODE_COUNT = 10;
const CODE_LENGTH = 10;

/** 24 huruf kapital tanpa I dan O, ditambah angka 2 sampai 9: tepat 32 simbol. */
export const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Satu kode berformat XXXXX-XXXXX. 256 habis dibagi 32, sehingga pemetaan byte & 31 tidak bias. */
export function generateBackupCode(): string {
  let code = "";
  for (const b of randomBytes(CODE_LENGTH)) code += BACKUP_CODE_ALPHABET[b & 31];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateBackupCode());
  return [...codes];
}

export function normalizeBackupCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, "");
}

export function looksLikeBackupCode(input: string): boolean {
  const code = normalizeBackupCode(input);
  return code.length === CODE_LENGTH && [...code].every((ch) => BACKUP_CODE_ALPHABET.includes(ch));
}
