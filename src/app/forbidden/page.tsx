import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatePage } from "@/components/state-page";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const t = await getTranslations("forbidden");
  return (
    <StatePage
      illustration="state-forbidden"
      title={t("title")}
      description={t("description")}
      action={
        <Button asChild variant="outline">
          <Link href="/assessments">{t("back")}</Link>
        </Button>
      }
    />
  );
}
