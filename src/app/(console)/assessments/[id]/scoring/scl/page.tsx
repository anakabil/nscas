import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RATING_STATUSES, loadScl } from "@/lib/assessor-scoring/service";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { SCORING_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { SclAspectForm } from "../scoring-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scoring.scl");
  return { title: t("title") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function SclPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, SCORING_ROLES.read));
  const t = await getTranslations("scoring");
  const [scl, assessment] = await Promise.all([
    loadScl(access.assessmentId),
    getDb().assessment.findUniqueOrThrow({ where: { id: access.assessmentId, organizationId: access.organizationId }, select: { status: true } }),
  ]);
  const canEdit = RATING_STATUSES.includes(assessment.status) && access.roles.some((r) => (SCORING_ROLES.scl as readonly string[]).includes(r));
  const tz = getAppTimeZone();

  return (
    <>
      <Link href={`/assessments/${access.assessmentId}/scoring`} className="text-brand-navy text-sm font-semibold underline">
        {t("workspace.back")}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{t("scl.title")}</CardTitle>
          <CardDescription>{t("scl.intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm">{t("scl.scale")}</p>
          <Alert variant={scl.complete ? "success" : "info"} data-testid="scl-status">
            {scl.complete ? t("scl.complete") : t("scl.incomplete")}
          </Alert>
          {!canEdit ? <p className="text-muted-foreground text-sm">{t("scl.readOnly")}</p> : null}
          {scl.aspects.map((a) => (
            <SclAspectForm
              key={a.code}
              assessmentId={access.assessmentId}
              aspect={{ code: a.code, name: a.name, weightLabel: formatNumber(a.weight * 100, 2) }}
              entries={a.entries.map((e, i) => ({
                step: i + 2,
                percent: e?.percent ?? null,
                justification: e?.justification ?? "",
                enteredBy: e ? t("scl.enteredBy", { name: e.enteredBy.name, time: formatDateTime(e.updatedAt, tz) }) : null,
              }))}
              canEdit={canEdit}
            />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
