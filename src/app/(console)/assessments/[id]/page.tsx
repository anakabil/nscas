import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ALL_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessments");
  return { title: t("title") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  // Ringkasan asesmen dapat dibuka semua peran yang berhubungan dengan asesmen ini.
  const access = await guardPage(() => requireRole(id, ALL_ROLES));
  const t = await getTranslations();

  const db = getDb();
  const assessment = await db.assessment.findUniqueOrThrow({
    where: { id: access.assessmentId, organizationId: access.organizationId },
    select: { name: true, status: true, targetLevel: true, organization: { select: { name: true } } },
  });
  const units =
    access.unitScope === null
      ? null
      : await db.unit.findMany({
          where: { assessmentId: access.assessmentId, id: { in: access.unitScope } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  return (
    <>
      <Link href="/assessments" className="text-brand-navy text-sm font-semibold hover:underline">
        {t("assessments.back")}
      </Link>
      {/* docs/05 bagian 2: nama organisasi, nama asesmen, dan status di bagian atas. */}
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">{assessment.organization.name}</p>
        <h1 className="text-brand-navy text-2xl font-bold">{assessment.name}</h1>
        <Badge variant="secondary">{t(`assessments.statuses.${assessment.status}`)}</Badge>
      </header>
      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <dt className="text-muted-foreground text-sm">{t("assessments.targetLevel")}</dt>
            <dd className="tabular-nums">{assessment.targetLevel}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessments.yourRoles")}</dt>
            <dd className="flex flex-wrap gap-2" data-testid="assessment-roles">
              {access.roles.map((r) => (
                <Badge key={r} variant="outline">
                  {t(`roles.${r}`)}
                </Badge>
              ))}
            </dd>
            <dt className="text-muted-foreground text-sm">{t("assessments.unitScope")}</dt>
            <dd>{units === null ? t("assessments.allUnits") : units.map((u) => u.name).join(", ")}</dd>
          </dl>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-sm">{t("assessments.detailIntro")}</p>
    </>
  );
}
