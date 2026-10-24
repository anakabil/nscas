import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ConfigurationNotice } from "@/components/assessment/locked-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireConfigurationPage } from "@/lib/assessments/page-access";
import { getDb } from "@/lib/db";
import { CreateStratumForm, EditStratumForm, PopulationTable } from "./strata-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("strata") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function StrataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const page = await requireConfigurationPage(id);
  const t = await getTranslations("assessment");
  const strata = await getDb().stratum.findMany({
    where: { assessmentId: page.access.assessmentId },
    select: { id: true, code: true, name: true, group: true, population: true, isContractor: true },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <p className="text-muted-foreground">{t("strata.intro")}</p>
      <ConfigurationNotice lockedAt={page.lockedAt} canWrite={page.canWrite} />
      {strata.length === 0 ? <p className="text-muted-foreground">{t("strata.empty")}</p> : null}
      <PopulationTable assessmentId={page.access.assessmentId} strata={strata} editable={page.editable} />
      {page.editable ? (
        <>
          <div className="space-y-2">
            {strata.map((s) => (
              <details key={s.id} className="border-border bg-card rounded-xl border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
                  <span className="font-mono">{s.code}</span> {s.name}
                </summary>
                <div className="border-border border-t px-4 py-4">
                  <EditStratumForm assessmentId={page.access.assessmentId} stratum={s} />
                </div>
              </details>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("strata.addTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateStratumForm assessmentId={page.access.assessmentId} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </>
  );
}
