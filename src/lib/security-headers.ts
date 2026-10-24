// Header keamanan (docs/04 bagian 5). Dipakai oleh src/middleware.ts.

/** Rute bertoken: survei (/s), penilaian mandiri (/sa), observasi (/o), dan kode QR unit (/q). */
export const SURVEY_PATH = /^\/(s|sa|o|q)(\/|$)/;

/** Asal penyimpanan objek dari variabel lingkungan; dipakai CSP agar peramban dapat mengunggah langsung ke sana. */
export function storageOriginFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(nonce: string, options: { development: boolean; storageOrigin?: string | null }): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const storage = options.storageOrigin ? ` ${options.storageOrigin}` : "";
  if (options.development) scriptSrc.push("'unsafe-eval'"); // React Refresh saat pengembangan
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Atribut style dari React dan next/font memerlukan 'unsafe-inline'; skrip tetap dibatasi nonce.
    "style-src 'self' 'unsafe-inline'",
    // Unggah langsung ke penyimpanan objek melalui URL bertanda tangan (docs/02 bagian 5), dan pratinjau
    // berkas yang dialihkan ke URL bertanda tangan.
    `img-src 'self' data: blob:${storage}`,
    "font-src 'self'",
    `connect-src 'self'${storage}`,
    `media-src 'self' blob:${storage}`,
    // Service worker aplikasi observasi (/o/sw.js); 'strict-dynamic' di script-src tidak berlaku untuk pekerja.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Di produksi penyimpanan objek memakai HTTPS. Penyimpanan HTTP lokal (MinIO saat pengujian build produksi)
  // akan rusak bila permintaannya dinaikkan ke HTTPS, sehingga arahan ini hanya dipasang bila asalnya HTTPS.
  if (!options.development && !options.storageOrigin?.startsWith("http:")) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function securityHeaders(pathname: string, options: { development: boolean }): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    // Rute survei: token tidak boleh bocor melalui perujuk.
    "Referrer-Policy": SURVEY_PATH.test(pathname) ? "no-referrer" : "strict-origin-when-cross-origin",
    // Kamera dan lokasi hanya untuk observasi digital (/o/*) di asal yang sama.
    "Permissions-Policy": "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (!options.development) headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  return headers;
}
