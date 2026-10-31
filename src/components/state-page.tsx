import { Illustration, type IllustrationName } from "@/components/illustration";

/** Halaman keadaan (akses ditolak, tidak ditemukan): ilustrasi, judul, penjelasan, dan satu tindakan. */
export function StatePage({ illustration, title, description, action }: { illustration: IllustrationName; title: string; description: string; action: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-12 sm:flex-row sm:gap-10">
      <Illustration name={illustration} priority className="w-56 shrink-0 sm:w-72" />
      <div className="space-y-4 text-center sm:text-left">
        <h1 className="text-brand-navy-deep text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <div>{action}</div>
      </div>
    </main>
  );
}
