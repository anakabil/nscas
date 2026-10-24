import Image from "next/image";
import Link from "next/link";
import { Activity, LogIn } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <Image
        src="/brand/logo-long-color.png"
        alt={t("app.logoAlt")}
        width={914}
        height={137}
        priority
        className="h-auto w-64"
      />
      <div className="space-y-3">
        <h1 className="text-brand-navy text-3xl font-bold">{t("app.name")}</h1>
        <p className="text-lg font-medium">{t("app.tagline")}</p>
        <p className="text-muted-foreground">{t("home.intro")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/login">
            <LogIn aria-hidden />
            {t("home.login")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/health">
            <Activity aria-hidden />
            {t("home.healthLink")}
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground border-border border-t pt-6 text-sm">{t("app.owner")}</p>
    </main>
  );
}
