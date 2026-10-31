import Image from "next/image";
import { cn } from "@/lib/utils";
import { ILLUSTRATIONS, type IllustrationName } from "./illustration-files";

export type { IllustrationName };

// Ilustrasi NSCAS di public/illustrations (docs/11 bagian 4). Semuanya hiasan: alt kosong, karena seluruh
// informasi ada di teks di sebelahnya. Bila berkas gagal dimuat, halaman tetap utuh.

export function Illustration({ name, className, priority }: { name: IllustrationName; className?: string; priority?: boolean }) {
  const { src, width, height } = ILLUSTRATIONS[name];
  return (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      priority={priority}
      // Ilustrasi tampil paling lebar 18rem; ukuran ini membatasi berkas yang dikirim ke peramban.
      sizes="(min-width: 640px) 288px, 60vw"
      className={cn("pointer-events-none h-auto select-none", className)}
      data-illustration={name}
    />
  );
}

/** Keadaan kosong: ilustrasi di samping pesan yang sama seperti sebelumnya (teks tetap menjadi sumber informasi). */
export function EmptyState({ illustration, children, className }: { illustration: IllustrationName; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-4 py-4 text-center sm:flex-row sm:gap-6 sm:text-left", className)}>
      <Illustration name={illustration} className="w-44 shrink-0 sm:w-52" />
      <div className="text-muted-foreground max-w-prose space-y-2">{children}</div>
    </div>
  );
}

/**
 * Lencana tingkat kematangan (docs/11 V20 sampai V24): cincin ukur lima busur, busur terisi sesuai tingkat. Angka
 * dipasang sebagai teks di tengah cincin, bukan bagian gambar. Hiasan: nama tingkat selalu tertulis di sebelahnya.
 */
export function LevelBadge({ level, size = "md", className }: { level: number; size?: "sm" | "md"; className?: string }) {
  const value = Math.min(5, Math.max(1, Math.round(level)));
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0", size === "sm" ? "size-11" : "size-16", className)} data-level-badge={value}>
      <Image src={`/illustrations/level-${value}.png`} alt="" width={512} height={512} sizes="96px" className="size-full" />
      <span className={cn("text-brand-navy-deep absolute inset-0 flex items-center justify-center font-bold tabular-nums", size === "sm" ? "text-sm" : "text-lg")}>
        {value}
      </span>
    </span>
  );
}
