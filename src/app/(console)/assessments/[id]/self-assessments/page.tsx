import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDate, formatNumber } from "@/lib/format";
import { listSelfAssessments } from "@/lib/self-assessment/service";
import { IssueSelfAssessmentForm, SelfAssessmentRowActions } from "./self-assessment-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("selfAssessments") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function SelfAssessmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, rolesFor("selfAssessments", "read")));
  const t = await getTranslations("selfAssessments");
  const db = getDb();
  const [assessment, units, rows] = await Promise.all([
    db.assessment.findUniqueOrThrow({ where: { id: access.assessmentId, organizationId: access.organizationId }, select: { status: true, instrumentVersionId: true } }),
    db.unit.findMany({ where: { assessmentId: access.assessmentId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listSelfAssessments(access.assessmentId),
  ]);
  const total = await db.characteristic.count({ where: { instrumentVersionId: assessment.instrumentVersionId } });
  const open = assessment.status === "LOCKED" || assessment.status === "DATA_COLLECTION";
  const canIssue = open && access.roles.some((r) => (rolesFor("tokensAndParticipation", "write") as readonly string[]).includes(r));
  const tz = getAppTimeZone();
  const statusOf = (r: (typeof rows)[number]) => (r.status === "SUBMITTED" ? "SUBMITTED" : r.revoked ? "REVOKED" : r.opened ? "DRAFT" : "NOT_OPENED");

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      {canIssue ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("issue.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <IssueSelfAssessmentForm assessmentId={access.assessmentId} units={units} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("table.title")}</CardTitle>
          <CardDescription>{formatNumber(rows.length)}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground">{t("table.empty")}</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("table.name")}</TableHeaderCell>
                  <TableHeaderCell>{t("table.position")}</TableHeaderCell>
                  <TableHeaderCell>{t("table.unit")}</TableHeaderCell>
                  <TableHeaderCell>{t("table.issuedAt")}</TableHeaderCell>
                  <TableHeaderCell>{t("table.progress")}</TableHeaderCell>
                  <TableHeaderCell>{t("table.status")}</TableHeaderCell>
                  <TableHeaderCell>{t("table.actions")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid="sa-row" data-status={statusOf(r)}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.position}</TableCell>
                    <TableCell>{r.unitName}</TableCell>
                    <TableCell>{formatDate(r.issuedAt, tz)}</TableCell>
                    <TableCell className="tabular-nums">{t("table.progressValue", { count: r.answered, total })}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "SUBMITTED" ? "success" : r.revoked ? "destructive" : "secondary"}>{t(`table.statuses.${statusOf(r)}`)}</Badge>
                    </TableCell>
                    <TableCell className="space-y-2">
                      <Link href={`/assessments/${access.assessmentId}/self-assessments/${r.id}`} className="text-brand-navy text-sm font-semibold underline">
                        {t("table.view")}
                      </Link>
                      {canIssue && r.status !== "SUBMITTED" ? <SelfAssessmentRowActions assessmentId={access.assessmentId} selfAssessmentId={r.id} revoked={r.revoked} /> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
