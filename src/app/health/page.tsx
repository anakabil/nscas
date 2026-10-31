import type { Metadata } from "next";
import Link from "next/link";
import { UiCheckCircle, UiDatabase, UiHardDrive, UiXCircle } from "@/components/icons/nscas-icons";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pingDatabase } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { checkHealth, type HealthComponent } from "@/lib/health";
import { pingStorage } from "@/lib/storage";

// Selalu diperiksa saat diminta, tidak pernah disajikan dari cache.
export const dynamic = "force-dynamic";

const ICONS: Record<HealthComponent, typeof UiDatabase> = {
  database: UiDatabase,
  storage: UiHardDrive,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("health");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function HealthPage() {
  const t = await getTranslations("health");
  const report = await checkHealth({ database: pingDatabase, storage: pingStorage });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>

      <div
        role="status"
        data-testid="health-overall"
        data-ok={report.ok}
        className={
          report.ok
            ? "bg-heat-good text-success rounded-xl px-4 py-3 font-semibold"
            : "bg-heat-low text-danger rounded-xl px-4 py-3 font-semibold"
        }
      >
        {report.ok ? t("overallOk") : t("overallError")}
      </div>

      <ul className="space-y-4">
        {report.components.map((c) => {
          const Icon = ICONS[c.component];
          return (
            <li key={c.component} data-testid={`health-${c.component}`} data-ok={c.ok}>
              <Card className="gap-3">
                <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-4">
                  <span className="bg-tint text-brand-navy flex size-10 items-center justify-center rounded-full">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <CardTitle>{t(`components.${c.component}`)}</CardTitle>
                    <CardDescription className="tabular-nums">
                      {t("latency", { ms: formatNumber(c.latencyMs) })}
                    </CardDescription>
                  </div>
                  <Badge variant={c.ok ? "success" : "destructive"}>
                    {c.ok ? <UiCheckCircle aria-hidden /> : <UiXCircle aria-hidden />}
                    {c.ok ? t("statusOk") : t("statusError")}
                  </Badge>
                </CardHeader>
                {c.errorCode ? (
                  <CardContent className="text-danger font-mono text-sm">
                    {t("errorCode", { code: c.errorCode })}
                  </CardContent>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-sm">
        {t("checkedAt", { time: formatDateTime(report.checkedAt, getAppTimeZone()) })}
      </p>
      {!report.ok ? <p className="text-muted-foreground text-sm">{t("hint")}</p> : null}

      <div>
        <Button variant="outline" asChild>
          <Link href="/">{t("back")}</Link>
        </Button>
      </div>
    </main>
  );
}
