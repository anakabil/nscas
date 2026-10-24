import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { VALIDATION_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { loadGuideTemplates } from "@/lib/validation/service";
import { GuideEditor } from "../validation-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("validation.guides");
  return { title: t("title") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function GuidesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, VALIDATION_ROLES.read));
  const t = await getTranslations("validation");
  const assessment = await getDb().assessment.findUniqueOrThrow({ where: { id: access.assessmentId, organizationId: access.organizationId }, select: { status: true, instrumentVersionId: true } });
  const [templates, characteristics] = await Promise.all([
    loadGuideTemplates(access.assessmentId),
    getDb().characteristic.findMany({ where: { instrumentVersionId: assessment.instrumentVersionId }, select: { code: true, nameId: true } }),
  ]);
  const canEdit = ["LOCKED", "DATA_COLLECTION", "SCORING"].includes(assessment.status) && access.roles.some((r) => (VALIDATION_ROLES.schedule as readonly string[]).includes(r));
  const names = Object.fromEntries(characteristics.map((c) => [c.code, c.nameId]));

  return (
    <>
      <Link href={`/assessments/${access.assessmentId}/validation`} className="text-brand-navy text-sm font-semibold underline">
        {t("session.back")}
      </Link>
      <p className="text-muted-foreground">{t("guides.intro")}</p>
      {templates.map((tpl) => (
        <Card key={tpl.layer}>
          <CardHeader>
            <CardTitle>{t(`layers.${tpl.layer}`)}</CardTitle>
          </CardHeader>
          <CardContent>
            <GuideEditor
              assessmentId={access.assessmentId}
              layer={tpl.layer}
              layerLabel={t(`layers.${tpl.layer}`)}
              intro={tpl.intro}
              questions={tpl.questions}
              names={names}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
