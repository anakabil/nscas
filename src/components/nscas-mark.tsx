import { cn } from "@/lib/utils";

// Logo aplikasi NSCAS (docs/11 bagian 5, konsep A): cincin ukur lima busur yang makin tebal dan makin gelap
// searah jarum jam (tingkat 1 ke 5), dengan titik merah di ujung busur kelima sebagai tujuan, yaitu budaya K3 yang
// matang. Sengaja tidak berbentuk tangga atau segel agar tidak dikira tanda sertifikasi Safety Culture Ladder.
// Warna di sini milik aset merek, bukan token tema; jalurnya sama dengan nscas-lockup.svg pada paket aset (docs/11 L05).

const ARCS = [
  { d: "M117.809 259.000 A118 118 0 0 1 103.793 179.510", width: 63, color: "#5a7797" },
  { d: "M108.429 161.583 A118 118 0 0 1 159.226 98.854", width: 69, color: "#516f90" },
  { d: "M175.796 90.592 A118 118 0 0 1 256.464 87.775", width: 75, color: "#42617f" },
  { d: "M273.571 94.861 A118 118 0 0 1 328.620 153.894", width: 81, color: "#2b4a6f" },
  { d: "M334.495 171.453 A118 118 0 0 1 326.058 251.728", width: 87, color: "#1e2f45" },
] as const;

const ACCENT = "#e62129";

/** Simbol logo NSCAS. tone="white" untuk latar biru batu gelap. Hiasan (aria-hidden) karena nama selalu tertulis di sebelahnya. */
export function NscasMark({ tone = "color", className }: { tone?: "color" | "white"; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="68 42 316 256"
      aria-hidden
      focusable="false"
      className={cn("h-auto shrink-0", className)}
      data-brand="nscas-mark"
    >
      {ARCS.map((arc) => (
        <path key={arc.d} d={arc.d} fill="none" stroke={tone === "white" ? "#ffffff" : arc.color} strokeWidth={arc.width} strokeLinecap="round" />
      ))}
      <circle cx="323.205" cy="257.208" r="23" fill={ACCENT} />
    </svg>
  );
}

/**
 * Logo mendatar NSCAS: simbol, nama aplikasi, dan baris pengenal "oleh Nusa Safety". Tulisan berupa teks HTML
 * (huruf Plus Jakarta Sans yang sudah dimuat halaman), bukan bagian gambar, agar tajam dan dapat diterjemahkan.
 */
export function NscasLockup({
  name,
  byline,
  tone = "color",
  size = "md",
  className,
}: {
  name: string;
  byline?: string;
  tone?: "color" | "white";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const mark = { sm: "w-8", md: "w-10", lg: "w-14" }[size];
  const title = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[size];
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <NscasMark tone={tone} className={mark} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-extrabold tracking-tight", title, tone === "white" ? "text-white" : "text-brand-navy-deep")}>{name}</span>
        {byline ? (
          <span className={cn("mt-1 text-xs font-medium", tone === "white" ? "text-white/65" : "text-muted-foreground")}>{byline}</span>
        ) : null}
      </span>
    </span>
  );
}
