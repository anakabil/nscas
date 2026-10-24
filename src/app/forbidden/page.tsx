import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const t = await getTranslations("forbidden");
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6">
      <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <div>
        <Button asChild variant="outline">
          <Link href="/assessments">{t("back")}</Link>
        </Button>
      </div>
    </main>
  );
}
