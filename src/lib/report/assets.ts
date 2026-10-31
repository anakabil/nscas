// Berkas aset laporan, relatif terhadap public/ (docs/11 V10 dan V20 sampai V24). Dipakai rute pratinjau HTML
// (sebagai alamat) dan worker PDF (dibaca lalu disisipkan sebagai data URI, karena Chromium worker tidak
// menjangkau server web).
export const REPORT_ASSET_FILES = {
  logo: "brand/logo-long-color.png",
  font: "fonts/PlusJakartaSans-latin-wght-normal.woff2",
  cover: "illustrations/report-cover.jpg",
  levelBadges: [1, 2, 3, 4, 5].map((level) => `illustrations/level-${level}.png`),
} as const;
