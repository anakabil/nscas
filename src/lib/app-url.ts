/** Alamat publik aplikasi untuk tautan di surel, kode QR, dan gambar pratinjau tautan. */
export function appUrl(): string {
  return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}
