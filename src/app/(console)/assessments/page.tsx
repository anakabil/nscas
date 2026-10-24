import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { listVisibleAssessments } from "@/lib/assessments/queries";
import { guardPage, requireUser } from "@/lib/auth/guard";
import { getAppTimeZone } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessments");
  return { title: t("title") };
}

export default async function AssessmentsPage() {
  const session = await guardPage(() => requireUser());
  const t = await getTranslations("assessments");
  const tAssessment = await getTranslations("assessment");
  const assessments = await listVisibleAssessments(session);
  const canCreate = session.principal.memberships.some((m) => m.organizationIsOperator && m.role === "LEAD_ASSESSOR");
  const tz = getAppTimeZone();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
        {canCreate ? (
          <Button asChild>
            <Link href="/assessments/new">{tAssessment("newButton")}</Link>
          </Button>
        ) : null}
      </div>
      {assessments.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("name")}</TableHeaderCell>
              <TableHeaderCell>{t("organization")}</TableHeaderCell>
              <TableHeaderCell>{t("period")}</TableHeaderCell>
              <TableHeaderCell>{t("status")}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {assessments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/assessments/${a.id}`} className="text-brand-navy font-semibold hover:underline">
                    {a.name}
                  </Link>
                </TableCell>
                <TableCell>{a.organization.name}</TableCell>
                <TableCell>
                  {t("periodRange", { start: formatDate(a.periodStart, tz), end: formatDate(a.periodEnd, tz) })}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{t(`statuses.${a.status}`)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
