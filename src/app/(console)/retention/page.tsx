import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { guardPage, requireSuperAdmin } from "@/lib/auth/guard";
import { getAppTimeZone } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { listRetention } from "@/lib/retention/service";
import { DestructionForm } from "./destruction-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("retention");
  return { title: t("title") };
}

// Retensi dan pemusnahan data mentah (docs/04 bagian 7), khusus SUPER_ADMIN.
export default async function RetentionPage() {
  await guardPage(() => requireSuperAdmin());
  const t = await getTranslations("retention");
  const tStatus = await getTranslations("assessments.statuses");
  const rows = await listRetention();
  const tz = getAppTimeZone();

  return (
    <div className="space-y-6">
      <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground max-w-3xl">{t("intro")}</p>
      {rows.length === 0 ? <p className="text-muted-foreground">{t("none")}</p> : null}
      {rows.map((r) => {
        const state = r.destruction
          ? t("states.destroyed", { date: formatDate(r.destruction.executedAt, tz) })
          : r.flaggedAt
            ? t("states.flagged", { date: formatDate(r.flaggedAt, tz) })
            : r.expired
              ? t("states.expired")
              : t("states.active");
        return (
          <Card key={r.id} data-testid="retention-row" data-assessment={r.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">
                  <Link href={`/assessments/${r.id}`} className="hover:underline">
                    {r.name}
                  </Link>
                </h2>
                <Badge variant="secondary">{tStatus(r.status)}</Badge>
                <Badge variant={r.destruction ? "outline" : r.expired ? "warning" : "success"} data-testid="retention-state">
                  {state}
                </Badge>
              </div>
              <dl className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="inline font-semibold">{t("columns.organization")}: </dt>
                  <dd className="inline">{r.organizationName}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">{t("columns.finalReport")}: </dt>
                  <dd className="inline">{r.finalReportSignedAt ? formatDate(r.finalReportSignedAt, tz) : ""}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">{t("columns.end")}: </dt>
                  <dd className="inline" data-testid="retention-end">
                    {r.retentionEnd ? formatDate(r.retentionEnd, tz) : ""}
                  </dd>
                </div>
              </dl>
              {r.destruction ? (
                r.destruction.pdfStatus === "READY" ? (
                  <a href={`/api/retention/${r.destruction.id}/pdf`} className="text-brand-navy text-sm font-semibold underline" data-testid="destruction-minutes">
                    {t("minutes")}
                  </a>
                ) : (
                  <p className="text-muted-foreground text-sm" data-testid="destruction-minutes-pending">
                    {t("minutesPending")}
                  </p>
                )
              ) : r.expired && r.status !== "ARCHIVED" ? (
                <p className="text-sm">{t("archiveFirst")}</p>
              ) : r.expired ? (
                <DestructionForm assessmentId={r.id} />
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
