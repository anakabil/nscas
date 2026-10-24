import { SiteHeader } from "@/components/console/site-header";
import { guardPage, requireUser } from "@/lib/auth/guard";

// Layout konsol hanya untuk tampilan. Hak akses tetap diperiksa di setiap halaman, Server Action,
// dan Route Handler melalui guard, karena layout tidak dijalankan ulang untuk setiap aksi.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await guardPage(() => requireUser());
  return (
    <>
      <SiteHeader session={session} showNavigation />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
