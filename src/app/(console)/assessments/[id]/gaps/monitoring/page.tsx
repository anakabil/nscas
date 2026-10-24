import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { groupByQuarter, loadActionPlan } from "@/lib/action-plan/service";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ACTION_PLAN_ROLES } from "@/lib/auth/roles";
import { formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("gaps.monitoring");
  return { title: t("title") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function MonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, ACTION_PLAN_ROLES.read));
  const t = await getTranslations("gaps");
  const plan = await loadActionPlan(access.assessmentId, access.unitScope);
  const quarters = groupByQuarter(plan);

  return (
    <>
      <Link href={`/assessments/${access.assessmentId}/gaps`} className="text-brand-navy text-sm font-semibold underline">
        {t("monitoring.back")}
      </Link>
      <h2 className="text-xl font-bold">{t("monitoring.title")}</h2>
      <p className="text-muted-foreground">{t("monitoring.intro")}</p>
      {quarters.length === 0 ? <Alert variant="info">{t("monitoring.none")}</Alert> : null}
      {quarters.map((q) => (
        <Card key={q.key} data-testid="quarter" data-quarter={q.key}>
          <CardHeader>
            <CardTitle>{t("monitoring.quarter", { quarter: q.quarter, year: q.year })}</CardTitle>
            <CardDescription data-testid="quarter-counts">
              {t("monitoring.counts", { ...q.counts })} · {t("monitoring.average", { percent: formatNumber(q.averageProgress, 0) })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("monitoring.characteristic")}</TableHeaderCell>
                  <TableHeaderCell>{t("fields.title")}</TableHeaderCell>
                  <TableHeaderCell>{t("fields.ownerName")}</TableHeaderCell>
                  <TableHeaderCell>{t("fields.dueDate")}</TableHeaderCell>
                  <TableHeaderCell>{t("fields.status")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("fields.progress")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {q.actions.map((a) => (
                  <TableRow key={a.id} data-testid="monitoring-row" data-due={a.dueState}>
                    <TableCell className="font-mono">{a.gapCode}</TableCell>
                    <TableCell>{a.title}</TableCell>
                    <TableCell>{t("actions.owner", { name: a.ownerName, position: a.ownerPosition })}</TableCell>
                    <TableCell>
                      {formatDate(a.dueDate, "UTC")}
                      {a.dueState === "overdue" ? (
                        <Badge variant="destructive" className="ml-2">
                          {t("due.overdue")}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{t(`statuses.${a.status}`)}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.progress}%</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
