// Header keamanan (docs/04 bagian 5). Dipakai oleh src/middleware.ts.

export const SURVEY_PATH = /^\/(s|sa|o)(\/|$)/;

export function buildContentSecurityPolicy(nonce: string, options: { development: boolean }): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (options.development) scriptSrc.push("'unsafe-eval'"); // React Refresh saat pengembangan
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Atribut style dari React dan next/font memerlukan 'unsafe-inline'; skrip tetap dibatasi nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!options.development) directives.push("upgrade-insecure-requests");
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
