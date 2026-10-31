// Palet warna NSCAS (docs/05 bagian 1): tenang dan tidak jenuh, agar tampilan nyaman dibaca lama dan angka hasil
// menjadi pusat perhatian. Nilai yang sama dipakai di src/app/globals.css (diperiksa tes src/lib/__tests__/theme.test.ts)
// dan di keluaran yang tidak dapat membaca variabel CSS: laporan PDF, surel, dan manifes aplikasi observasi.

export const PALETTE = {
  /** Biru batu tua: tombol utama, tautan, judul, batang grafik yang mencapai sasaran. */
  navy: "#2b4a6f",
  /** Biru batu gelap: bidang kepala halaman tempat logo, dan judul utama. */
  navyDeep: "#1e2f45",
  /** Oker lembut: sorotan dan nilai di bawah sasaran pada grafik. */
  highlight: "#c29b52",
  /** Hijau toska redup: seri kedua grafik, misalnya karakteristik kontekstual. */
  series2: "#6e9a94",
  text: "#1f2933",
  textMuted: "#5c6773",
  surface: "#ffffff",
  surfaceAlt: "#f4f5f7",
  tint: "#e8edf2",
  border: "#d9dee4",
  success: "#2e7458",
  warning: "#8a5a12",
  danger: "#a3433a",
  heatGood: "#ddebe3",
  heatMid: "#f2ead4",
  heatLow: "#f2deda",
  heatSuppressed: "#e7e9ec",
} as const;

/** Gradasi lima tingkat kematangan, 1 sampai 5. */
export const LEVEL_COLORS = ["#cbd3dc", "#a9b8c8", "#8399b1", "#5a7797", "#2b4a6f"] as const;
