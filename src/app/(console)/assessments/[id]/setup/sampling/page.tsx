import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ConfigurationNotice } from "@/components/assessment/locked-notice";
import { Alert } from "@/components/ui/alert";
import { loadEffectiveParameters } from "@/lib/assessments/load";
import { requireConfigurationPage } from "@/lib/assessments/page-access";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { SampleCalculator } from "./sample-calculator";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("sampling") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function SamplingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const page = await requireConfigurationPage(id);
  const t = await getTranslations("assessment.sampling");
  const db = getDb();

  const [strata, unitTypes, effective] = await Promise.all([
    db.stratum.findMany({ where: { assessmentId: page.access.assessmentId }, select: { code: true, name: true, population: true }, orderBy: { code: "asc" } }),
    db.unit.groupBy({ by: ["type"], where: { assessmentId: page.access.assessmentId }, _count: { _all: true } }),
    loadEffectiveParameters(page.access.assessmentId),
  ]);
  const stored = effective.parameters.samplePlan ?? null;
  // Bawaan: N = jumlah unit berjenis proyek, X = jumlah unit lainnya (kantor pusat, divisi, cabang).
  const projectUnits = unitTypes.find((u) => u.type === "PROJECT")?._count._all ?? 0;
  const otherUnits = unitTypes.filter((u) => u.type !== "PROJECT").reduce((s, u) => s + u._count._all, 0);
  const sampling = effective.parameters.sampling;

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      <ConfigurationNotice lockedAt={page.lockedAt} canWrite={page.canWrite} />
      {stored ? (
        <Alert variant="success" data-testid="sample-plan-saved">
          {t("lastSaved", { time: formatDateTime(new Date(stored.computedAt), getAppTimeZone()), target: formatNumber(stored.result.surveyTargetTotal) })}
        </Alert>
      ) : (
        <Alert variant="warning" data-testid="sample-plan-missing">
          {t("notSaved")}
        </Alert>
      )}
      <SampleCalculator
        assessmentId={page.access.assessmentId}
        strata={strata}
        defaults={{ projects: stored?.projects ?? projectUnits, locations: stored?.locations ?? otherUnits }}
        settings={{
          z: sampling.z,
          marginOfError: sampling.marginOfError,
          proportion: sampling.proportion,
          minParticipationPerStratum: sampling.minParticipationPerStratum,
          sclInterviewFactorManagement: sampling.sclInterviewFactorManagement,
          sclInterviewFactorOperational: sampling.sclInterviewFactorOperational,
          sclProjectFactor: sampling.sclProjectFactor,
        }}
        editable={page.editable}
      />
    </>
  );
}
