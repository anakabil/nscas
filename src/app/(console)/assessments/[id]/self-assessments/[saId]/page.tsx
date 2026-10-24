import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { loadSelfAssessmentDetail } from "@/lib/self-assessment/service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("selfAssessments") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64), saId: z.string().min(1).max(64) });

export default async function SelfAssessmentDetailPage({ params }: { params: Promise<{ id: string; saId: string }> }) {
  const { id, saId } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, rolesFor("selfAssessments", "read")));
  const detail = await loadSelfAssessmentDetail(access.assessmentId, saId);
  if (!detail) notFound();
  const t = await getTranslations("selfAssessments.detail");
  const tz = getAppTimeZone();

  return (
    <>
      <Link href={`/assessments/${access.assessmentId}/self-assessments`} className="text-brand-navy text-sm font-semibold underline">
        {t("back")}
      </Link>
      <div className="space-y-1">
        <h2 className="text-xl font-bold" data-testid="sa-detail-respondent">
          {t("respondent", { name: detail.respondentName, position: detail.respondentPosition })}
        </h2>
        <p className="text-muted-foreground">{detail.unitName}</p>
        {detail.status === "SUBMITTED" && detail.submittedAt ? (
          <p data-testid="sa-detail-status">{t("submittedAt", { date: formatDateTime(detail.submittedAt, tz) })}</p>
        ) : (
          <Alert variant="info">{t("draft")}</Alert>
        )}
      </div>
      <div className="space-y-4">
        {detail.rows.map((r) => (
          <Card key={r.code} data-testid="sa-detail-row">
            <CardHeader>
              <CardTitle>
                {r.code} {r.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {r.level ? (
                <p>
                  <span className="font-semibold">{t("level", { level: r.level })}.</span> {r.statement}
                </p>
              ) : (
                <p className="text-muted-foreground">{t("noAnswer")}</p>
              )}
              {r.justification ? (
                <div>
                  <p className="font-semibold">{t("justification")}</p>
                  <p className="whitespace-pre-line">{r.justification}</p>
                </div>
              ) : null}
              <div>
                <p className="font-semibold">{t("evidence")}</p>
                {r.evidence.length === 0 ? (
                  <p className="text-muted-foreground">{t("noEvidence")}</p>
                ) : (
                  <ul className="list-disc pl-5">
                    {r.evidence.map((e) => (
                      <li key={e.id}>
                        {e.title} {e.deletedAt ? `(${t("deleted")})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
