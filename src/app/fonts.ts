import localFont from "next/font/local";

// Plus Jakarta Sans dimuat dari berkas lokal (lisensi SIL OFL 1.1, lihat fonts/OFL.txt),
// sehingga peramban responden tidak menghubungi server huruf pihak ketiga. Hanya gaya tegak yang dimuat:
// antarmuka tidak memakai huruf miring, dan setiap berkas huruf menambah muatan halaman survei.
export const plusJakartaSans = localFont({
  src: [
    { path: "./fonts/PlusJakartaSans-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});
