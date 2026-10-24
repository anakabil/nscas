import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AssessmentDetailsForm } from "@/components/assessment/details-form";
import { Card, CardContent } from "@/components/ui/card";
import { guardPage, requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { createAssessmentAction } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment");
  return { title: t("newTitle") };
}

export default async function NewAssessmentPage() {
  const session = await guardPage(() => requireUser());
  // Hanya lead assessor Nusa Safety; aksi pembuatannya diperiksa lagi dengan requireOrganizationRole.
  if (!session.principal.memberships.some((m) => m.organizationIsOperator && m.role === "LEAD_ASSESSOR")) redirect("/forbidden");
  const t = await getTranslations("assessment");
  const db = getDb();
  const [organizations, instrumentVersions] = await Promise.all([
    db.organization.findMany({ where: { isOperator: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.instrumentVersion.findMany({ where: { status: "PUBLISHED" }, select: { id: true, code: true }, orderBy: { code: "desc" } }),
  ]);

  return (
    <>
      <h1 className="text-brand-navy text-2xl font-bold">{t("newTitle")}</h1>
      <p className="text-muted-foreground">{t("newIntro")}</p>
      <Card>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-muted-foreground">{t("noClientOrganization")}</p>
          ) : (
            <AssessmentDetailsForm
              action={createAssessmentAction}
              organizations={organizations}
              instrumentVersions={instrumentVersions}
              editable
              submitLabel={t("create")}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
