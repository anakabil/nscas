import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";

/** docs/04 bagian 3: minimal 12 karakter. Batas atas mencegah masukan sangat panjang ke argon2. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Menyamakan lama proses untuk surel yang tidak terdaftar, agar keberadaan akun tidak terbaca dari waktu tanggap. */
export async function burnPasswordVerification(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(await dummyHash, password);
}

const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // 56 simbol

/** Kata sandi sementara 16 karakter (sekitar 93 bit) untuk akun baru atau atur ulang oleh administrator. */
export function generateTemporaryPassword(length = 16): string {
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length)) {
      // Tolak byte di atas kelipatan 56 agar tidak bias.
      if (b < 224 && out.length < length) out += TEMP_ALPHABET[b % 56];
    }
  }
  return out;
}
