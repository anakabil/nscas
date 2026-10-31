import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { NscasLockup } from "@/components/nscas-mark";

// Halaman masuk dan verifikasi: panel identitas di kiri (layar lebar), formulir di kanan.
// Panel memakai ilustrasi V01 (docs/11): bidang atasnya kosong untuk logo dan teks, lokasi proyek di bawah.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-brand-navy-deep relative hidden overflow-hidden text-white lg:block">
        <Image src="/illustrations/login-panel.webp" alt="" fill priority sizes="42vw" className="object-cover object-bottom" />
        <div className="relative flex h-full flex-col p-12">
          <BrandLogo alt={t("logoAlt")} priority framed={false} className="h-9 self-start" />
          <div className="mt-[14vh] max-w-md space-y-5">
            <NscasLockup name={t("name")} tone="white" size="lg" />
            <p className="text-sm font-medium tracking-wide text-white/65">{t("fullName")}</p>
            <p className="text-lg leading-relaxed text-white/85">{t("tagline")}</p>
          </div>
          <p className="mt-auto text-sm text-white/75">{t("owner")}</p>
        </div>
      </aside>
      <main className="flex flex-col justify-center px-5 py-12">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <NscasLockup name={t("name")} byline={t("byline")} className="self-start lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
