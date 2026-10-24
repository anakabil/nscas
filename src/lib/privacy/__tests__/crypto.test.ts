import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptField,
  DecryptionError,
  encryptField,
  fieldContext,
  keyedHash,
  openToken,
  parseEncryptionKey,
  sealToken,
} from "../crypto";

const key = randomBytes(32);
const ctx = fieldContext("User", "totpSecretEnc", "user-1");

describe("enkripsi kolom AES-256-GCM", () => {
  it("mendekripsi kembali teks asli", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    expect(decryptField(encryptField(secret, ctx, key), ctx, key)).toBe(secret);
    expect(decryptField(encryptField("", ctx, key), ctx, key)).toBe("");
    expect(decryptField(encryptField("surel@contoh.co.id ✓", ctx, key), ctx, key)).toBe("surel@contoh.co.id ✓");
  });

  it("memakai IV acak sehingga sandi berbeda untuk teks yang sama", () => {
    expect(encryptField("x", ctx, key)).not.toBe(encryptField("x", ctx, key));
  });

  it("berformat v1 dengan IV 12 byte dan tag 16 byte", () => {
    const [version, iv, , tag] = encryptField("x", ctx, key).split(".");
    expect(version).toBe("v1");
    expect(Buffer.from(iv, "base64url")).toHaveLength(12);
    expect(Buffer.from(tag, "base64url")).toHaveLength(16);
  });

  it("gagal bila dipindahkan ke baris atau kolom lain (konteks AAD berbeda)", () => {
    const payload = encryptField("rahasia", ctx, key);
    expect(() => decryptField(payload, fieldContext("User", "totpSecretEnc", "user-2"), key)).toThrow(DecryptionError);
    expect(() => decryptField(payload, fieldContext("RosterEntry", "emailEnc", "user-1"), key)).toThrow(DecryptionError);
  });

  it("gagal bila sandi diubah atau kunci salah", () => {
    const payload = encryptField("rahasia", ctx, key);
    const [v, iv, ct, tag] = payload.split(".");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptField([v, iv, flipped.toString("base64url"), tag].join("."), ctx, key)).toThrow(DecryptionError);
    expect(() => decryptField(payload, ctx, randomBytes(32))).toThrow(DecryptionError);
    expect(() => decryptField("v2.a.b.c", ctx, key)).toThrow(DecryptionError);
    expect(() => decryptField("bukan sandi", ctx, key)).toThrow(DecryptionError);
  });
});

describe("kunci", () => {
  it("menerima 32 byte base64 dan menolak panjang lain", () => {
    expect(parseEncryptionKey(randomBytes(32).toString("base64"))).toHaveLength(32);
    expect(parseEncryptionKey(randomBytes(32).toString("base64url"))).toHaveLength(32);
    expect(() => parseEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
    expect(() => parseEncryptionKey(undefined)).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it("hash berkunci stabil per keperluan dan berbeda antarkeperluan", () => {
    expect(keyedHash("10.0.0.1", "audit-ip", key)).toBe(keyedHash("10.0.0.1", "audit-ip", key));
    expect(keyedHash("10.0.0.1", "audit-ip", key)).not.toBe(keyedHash("10.0.0.1", "login-rate", key));
    expect(keyedHash("10.0.0.1", "audit-ip", key)).not.toContain("10.0.0.1");
  });
});

describe("token tersegel", () => {
  // sealToken memakai kunci dari lingkungan; tes ini menyiapkannya.
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

  it("dibuka kembali sebelum kedaluwarsa", () => {
    const token = sealToken({ uid: "u1" }, "login-challenge", 60_000, 1_000);
    expect(openToken(token, "login-challenge", 2_000)).toMatchObject({ uid: "u1" });
  });

  it("ditolak setelah kedaluwarsa, untuk keperluan lain, atau bila rusak", () => {
    const token = sealToken({ uid: "u1" }, "login-challenge", 60_000, 1_000);
    expect(openToken(token, "login-challenge", 61_000)).toBeNull();
    expect(openToken(token, "session-grant", 2_000)).toBeNull();
    expect(openToken(token.slice(0, -2), "login-challenge", 2_000)).toBeNull();
  });
});
