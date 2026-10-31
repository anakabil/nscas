import Image from "next/image";
import { cn } from "@/lib/utils";

// Ilustrasi rute bertoken: survei, penilaian mandiri, dan kode QR (docs/11 V07 sampai V09 dan V18). Halaman ini
// dibuka pekerja dengan sinyal lemah, sehingga berkas yang sudah kecil (4 sampai 8 KB) dikirim apa adanya
// (unoptimized) dan muatan tetap terukur oleh tes anggaran 350 KB. Semuanya hiasan dengan alt kosong.

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
    <Image
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      unoptimized
      priority={priority}
      className={cn("pointer-events-none mx-auto h-auto w-full max-w-xs select-none", className)}
      data-illustration={name}
    />
  );
}
