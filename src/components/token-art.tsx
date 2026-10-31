import { cn } from "@/lib/utils";

// Ilustrasi rute bertoken: survei, penilaian mandiri, dan kode QR (docs/11 V07 sampai V09 dan V18). Halaman ini
// dibuka pekerja dengan sinyal lemah. Berkasnya sudah kecil (4 sampai 8 KB) dan dikirim apa adanya, sehingga
// elemen img biasa dipakai: komponen next/image menambah sekitar 5 KB JavaScript tanpa manfaat di sini.
// Semuanya hiasan dengan alt kosong; lebar dan tinggi tetap mencegah tata letak bergeser saat gambar dimuat.

const ART = {
  welcome: { src: "/illustrations/survey-welcome.webp", width: 720, height: 480 },
  privacy: { src: "/illustrations/survey-privacy.webp", width: 480, height: 480 },
  thanks: { src: "/illustrations/survey-thanks.webp", width: 720, height: 480 },
  unavailable: { src: "/illustrations/state-link-unavailable.png", width: 800, height: 600 },
} as const;

export type TokenArtName = keyof typeof ART;

export function TokenArt({ name, className, priority }: { name: TokenArtName; className?: string; priority?: boolean }) {
  const art = ART[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- lihat catatan di atas: muatan halaman survei.
    <img
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={cn("pointer-events-none mx-auto h-auto w-full max-w-xs select-none", className)}
      data-illustration={name}
    />
  );
}
