// Enkripsi kolom *Enc dengan AES-256-GCM (docs/04 bagian 4) dan utilitas kriptografi terkait.
//
// Format sandi: v1.<iv>.<ciphertext>.<tag>, masing-masing base64url. Setiap sandi diikat ke
// konteks (AAD), misalnya "User.totpSecretEnc:<userId>", sehingga sandi dari satu kolom atau
// baris tidak dapat dipindahkan ke kolom atau baris lain tanpa gagal didekripsi.
//
// Modul ini tidak bergantung pada Next.js agar dapat dipakai oleh skrip seed dan tes.

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class DecryptionError extends Error {
  constructor(message = "Ciphertext could not be decrypted") {
    super(message);
    this.name = "DecryptionError";
  }
}

/** Mengurai DATA_ENCRYPTION_KEY: 32 byte dalam base64 (standar atau base64url). */
export function parseEncryptionKey(value: string | undefined): Buffer {
  const key = value ? Buffer.from(value.trim(), "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes encoded as base64 (generate with: openssl rand -base64 32)");
  }
  return key;
}

let cachedKey: { raw: string | undefined; key: Buffer } | undefined;

function defaultKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!cachedKey || cachedKey.raw !== raw) cachedKey = { raw, key: parseEncryptionKey(raw) };
  return cachedKey.key;
}

/** Konteks AAD baku untuk kolom terenkripsi. Sertakan id baris bila sudah diketahui. */
export function fieldContext(model: string, column: string, rowId?: string): string {
  return rowId ? `${model}.${column}:${rowId}` : `${model}.${column}`;
}

export function encryptField(plaintext: string, context: string, key: Buffer = defaultKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, ciphertext, tag].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

export function decryptField(payload: string, context: string, key: Buffer = defaultKey()): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new DecryptionError("Unsupported ciphertext format");
  const [, ivPart, ctPart, tagPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new DecryptionError("Malformed ciphertext");
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ctPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new DecryptionError();
  }
}

/** Kunci turunan per keperluan (HKDF-SHA256), agar kunci induk tidak dipakai langsung untuk banyak hal. */
export function deriveKey(purpose: string, key: Buffer = defaultKey()): Buffer {
  return Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), `nscas:${purpose}`, 32));
}

/** HMAC-SHA256 berkunci turunan, dalam heksadesimal. Untuk hash alamat IP pada jejak audit. */
export function keyedHash(value: string, purpose: string, key: Buffer = defaultKey()): string {
  return createHmac("sha256", deriveKey(purpose, key)).update(value, "utf8").digest("hex");
}

/**
 * Token tersegel berumur pendek (terenkripsi dan terautentikasi) untuk keperluan internal,
 * misalnya tantangan masuk dua langkah. Mengembalikan null bila rusak, salah keperluan, atau kedaluwarsa.
 */
export function sealToken(payload: Record<string, unknown>, purpose: string, ttlMs: number, now = Date.now()): string {
  const body = JSON.stringify({ ...payload, exp: now + ttlMs });
  return encryptField(body, `token:${purpose}`, deriveKey(`token:${purpose}`));
}

export function openToken<T extends Record<string, unknown>>(token: string, purpose: string, now = Date.now()): T | null {
  try {
    const body = JSON.parse(decryptField(token, `token:${purpose}`, deriveKey(`token:${purpose}`))) as T & { exp?: unknown };
    if (typeof body.exp !== "number" || body.exp <= now) return null;
    return body;
  } catch {
    return null;
  }
}
