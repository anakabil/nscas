import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AssessmentDetailsForm } from "@/components/assessment/details-form";
import { ConfigurationNotice } from "@/components/assessment/locked-notice";
import { Card, CardContent } from "@/components/ui/card";
import { requireConfigurationPage } from "@/lib/assessments/page-access";
import { getDb } from "@/lib/db";
import { updateDetailsAction } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("details") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function AssessmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const page = await requireConfigurationPage(id);
  const t = await getTranslations("assessment");
  const db = getDb();
  const [assessment, instrumentVersions] = await Promise.all([
    db.assessment.findUniqueOrThrow({
      where: { id: page.access.assessmentId },
      select: { name: true, scopeType: true, periodStart: true, periodEnd: true, targetLevel: true, instrumentVersionId: true, instrumentVersion: { select: { code: true } } },
    }),
    db.instrumentVersion.findMany({ where: { status: "PUBLISHED" }, select: { id: true, code: true }, orderBy: { code: "desc" } }),
  ]);
  const versions = instrumentVersions.some((v) => v.id === assessment.instrumentVersionId)
    ? instrumentVersions
    : [{ id: assessment.instrumentVersionId, code: assessment.instrumentVersion.code }, ...instrumentVersions];

  return (
    <>
      <ConfigurationNotice lockedAt={page.lockedAt} canWrite={page.canWrite} />
      <Card>
        <CardContent>
          <AssessmentDetailsForm
            action={updateDetailsAction.bind(null, page.access.assessmentId)}
            values={{
              name: assessment.name,
              scopeType: assessment.scopeType,
              periodStart: assessment.periodStart.toISOString().slice(0, 10),
              periodEnd: assessment.periodEnd.toISOString().slice(0, 10),
              targetLevel: assessment.targetLevel,
              instrumentVersionId: assessment.instrumentVersionId,
            }}
            instrumentVersions={versions}
            editable={page.editable}
            submitLabel={t("save")}
          />
        </CardContent>
      </Card>
    </>
  );
}
