import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <BrandLogo alt={t("logoAlt")} priority className="h-12 self-start" />
      {children}
    </main>
  );
}
