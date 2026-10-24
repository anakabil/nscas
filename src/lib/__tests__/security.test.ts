import { describe, expect, it } from "vitest";
import { redactForAudit } from "@/lib/audit";
import { buildContentSecurityPolicy, securityHeaders, storageOriginFromEnv } from "@/lib/security-headers";

describe("Content-Security-Policy", () => {
  it("skrip hanya dari asal sendiri dengan nonce, tanpa 'unsafe-inline' dan tanpa pihak ketiga", () => {
    const csp = buildContentSecurityPolicy("abc123", { development: false });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(script).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it("'unsafe-eval' hanya saat pengembangan", () => {
    expect(buildContentSecurityPolicy("n", { development: true })).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy("n", { development: false })).not.toContain("'unsafe-eval'");
  });
});

describe("header keamanan", () => {
  it("X-Frame-Options DENY di semua rute", () => {
    expect(securityHeaders("/assessments", { development: false })["X-Frame-Options"]).toBe("DENY");
  });

  it("Referrer-Policy no-referrer pada rute survei agar token tidak bocor", () => {
    for (const path of ["/s/abc", "/sa/xyz", "/o/w1", "/q/kode"]) {
      expect(securityHeaders(path, { development: false })["Referrer-Policy"]).toBe("no-referrer");
    }
    expect(securityHeaders("/sample", { development: false })["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("HSTS hanya di produksi", () => {
    expect(securityHeaders("/", { development: false })["Strict-Transport-Security"]).toMatch(/max-age=/);
    expect(securityHeaders("/", { development: true })["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("jejak audit tidak pernah memuat kredensial", () => {
  it("menyembunyikan kata sandi, hash, rahasia, token, dan kolom terenkripsi; kunci kode lain tetap", () => {
    expect(
      redactForAudit({
        password: "x",
        passwordHash: "x",
        totpSecretEnc: "x",
        tokenHash: "x",
        nested: { emailEnc: "x", name: "Budi" },
        aspectCode: "A1",
        stratumCode: "S1",
        email: "budi@contoh.co.id",
      }),
    ).toEqual({
      password: "[disembunyikan]",
      passwordHash: "[disembunyikan]",
      totpSecretEnc: "[disembunyikan]",
      tokenHash: "[disembunyikan]",
      nested: { emailEnc: "[disembunyikan]", name: "Budi" },
      aspectCode: "A1",
      stratumCode: "S1",
      email: "budi@contoh.co.id",
    });
  });
});

describe("asal penyimpanan objek di CSP", () => {
  it("mengizinkan unggah dan pratinjau langsung ke penyimpanan objek, tanpa melonggarkan skrip", () => {
    const origin = storageOriginFromEnv({ S3_ENDPOINT: "http://minio:9000", S3_PUBLIC_ENDPOINT: "https://berkas.nscas.nusasafety.co.id/bucket" });
    expect(origin).toBe("https://berkas.nscas.nusasafety.co.id");
    const csp = buildContentSecurityPolicy("n", { development: false, storageOrigin: origin });
    expect(csp).toContain("connect-src 'self' https://berkas.nscas.nusasafety.co.id");
    expect(csp).toContain("img-src 'self' data: blob: https://berkas.nscas.nusasafety.co.id");
    expect(csp).not.toMatch(/script-src[^;]*berkas/);
    expect(storageOriginFromEnv({})).toBeNull();
    expect(csp).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy("n", { development: false, storageOrigin: "http://localhost:9000" })).not.toContain("upgrade-insecure-requests");
  });
});

