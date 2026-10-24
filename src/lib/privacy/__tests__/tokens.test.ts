import { describe, expect, it } from "vitest";
import { generateToken, hashToken, looksLikeToken, roundToNearestHour, selfAssessmentLink, surveyLink, unitQrLink } from "../tokens";

describe("token responden", () => {
  it("32 byte acak dalam base64url (43 karakter) dan selalu berbeda", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(t, "base64url")).toHaveLength(32);
      expect(looksLikeToken(t)).toBe(true);
    }
  });

  it("hash SHA-256 heksadesimal yang deterministik dan tidak memuat token", () => {
    const raw = generateToken();
    expect(hashToken(raw)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toContain(raw);
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("menolak bentuk yang bukan token sebelum menyentuh basis data", () => {
    for (const bad of ["", "abc", "x".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(42)}/`]) expect(looksLikeToken(bad)).toBe(false);
  });

  it("menyusun tautan tanpa garis miring ganda", () => {
    expect(surveyLink("https://nscas.nusasafety.co.id/", "T")).toBe("https://nscas.nusasafety.co.id/s/T");
    expect(selfAssessmentLink("https://a.id", "T")).toBe("https://a.id/sa/T");
    expect(unitQrLink("https://a.id//", "T")).toBe("https://a.id/q/T");
  });

  it("membulatkan waktu selesai ke jam terdekat", () => {
    expect(roundToNearestHour(new Date("2026-11-02T08:29:59Z")).toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect(roundToNearestHour(new Date("2026-11-02T08:30:00Z")).toISOString()).toBe("2026-11-02T09:00:00.000Z");
  });
});
