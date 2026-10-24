import { SiteHeader } from "@/components/console/site-header";
import { guardPage, requireUser } from "@/lib/auth/guard";

// Halaman akun dapat dibuka selama pengguna masih wajib mengaktifkan verifikasi dua langkah
// atau mengganti kata sandi sementara.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await guardPage(() => requireUser({ allowSetupPending: true }));
  const setupPending = session.totpPending || session.user.mustChangePassword;
  return (
    <>
      <SiteHeader session={session} showNavigation={!setupPending} />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
