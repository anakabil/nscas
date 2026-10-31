import Image from "next/image";
import { cn } from "@/lib/utils";

// Ilustrasi NSCAS di public/illustrations (docs/11 bagian 4). Semuanya hiasan: alt kosong, karena seluruh
// informasi ada di teks di sebelahnya. Bila berkas gagal dimuat, halaman tetap utuh.

export const ILLUSTRATIONS = {
  "empty-start": { src: "/illustrations/empty-start.png", width: 800, height: 600 },
  "empty-respondents": { src: "/illustrations/empty-respondents.png", width: 800, height: 600 },
  "empty-evidence": { src: "/illustrations/empty-evidence.png", width: 800, height: 600 },
  "empty-observations": { src: "/illustrations/empty-observations.png", width: 800, height: 600 },
  "empty-report": { src: "/illustrations/empty-report.png", width: 800, height: 600 },
  "empty-action-plan": { src: "/illustrations/empty-action-plan.png", width: 800, height: 600 },
  "state-forbidden": { src: "/illustrations/state-forbidden.png", width: 800, height: 600 },
  "state-not-found": { src: "/illustrations/state-not-found.png", width: 800, height: 600 },
  "phase-preparation": { src: "/illustrations/phase-preparation.png", width: 640, height: 480 },
  "phase-data-collection": { src: "/illustrations/phase-data-collection.png", width: 640, height: 480 },
  "phase-scoring": { src: "/illustrations/phase-scoring.png", width: 640, height: 480 },
  "phase-results": { src: "/illustrations/phase-results.png", width: 640, height: 480 },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

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
export function LevelBadge({ level, className }: { level: number; className?: string }) {
  const value = Math.min(5, Math.max(1, Math.round(level)));
  return (
    <span aria-hidden className={cn("relative inline-flex size-16 shrink-0", className)} data-level-badge={value}>
      <Image src={`/illustrations/level-${value}.png`} alt="" width={512} height={512} sizes="96px" className="size-full" />
      <span className="text-brand-navy-deep absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">{value}</span>
    </span>
  );
}
