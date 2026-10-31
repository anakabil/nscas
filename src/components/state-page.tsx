import { ILLUSTRATIONS, type IllustrationName } from "@/components/illustration-files";

/**
 * Halaman keadaan (akses ditolak, tidak ditemukan): ilustrasi, judul, penjelasan, dan satu tindakan.
 * Memakai elemen img biasa, bukan next/image: halaman tidak ditemukan adalah batas milik layout akar, sehingga
 * komponennya ikut dikirim ke setiap rute, termasuk survei yang muatannya dijaga ketat (docs/05 bagian 3).
 */
export function StatePage({ illustration, title, description, action }: { illustration: IllustrationName; title: string; description: string; action: React.ReactNode }) {
  const art = ILLUSTRATIONS[illustration];
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-12 sm:flex-row sm:gap-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- lihat catatan komponen. */}
      <img src={art.src} alt="" width={art.width} height={art.height} decoding="async" className="pointer-events-none h-auto w-56 shrink-0 select-none sm:w-72" data-illustration={illustration} />
      <div className="space-y-4 text-center sm:text-left">
        <h1 className="text-brand-navy-deep text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <div>{action}</div>
      </div>
    </main>
  );
}
