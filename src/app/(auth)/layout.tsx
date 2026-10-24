import Image from "next/image";
import { getTranslations } from "next-intl/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <Image src="/brand/logo-long-color.png" alt={t("logoAlt")} width={914} height={137} priority className="h-auto w-56" />
      {children}
    </main>
  );
}
