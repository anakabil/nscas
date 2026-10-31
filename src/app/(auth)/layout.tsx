import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";

// Halaman masuk dan verifikasi: panel identitas di kiri (layar lebar), formulir di kanan.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-brand-navy-deep hidden flex-col justify-between p-12 text-white lg:flex">
        <BrandLogo alt={t("logoAlt")} priority framed={false} className="h-10 self-start" />
        <div className="max-w-md space-y-3">
          <p className="text-3xl font-semibold">{t("name")}</p>
          <p className="text-sm font-medium tracking-wide text-white/60">{t("fullName")}</p>
          <p className="text-lg leading-relaxed text-white/85">{t("tagline")}</p>
        </div>
        <p className="text-sm text-white/55">{t("owner")}</p>
      </aside>
      <main className="flex flex-col justify-center px-5 py-12">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <BrandLogo alt={t("logoAlt")} priority className="h-11 self-start lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
