import { UiArrowRight, UiCheckCircle, UiPlus } from "@/components/icons/nscas-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { listVisibleAssessments } from "@/lib/assessments/queries";
import { PHASES, phaseOf } from "@/lib/assessments/workflow";
import { guardPage, requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Illustration } from "@/components/illustration";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessments");
  return { title: t("title") };
}

interface StartStep {
  key: "organization" | "lead" | "assessment";
  done: boolean;
  href: string | null;
  hint?: string;
}

/**
 * Panduan memulai pengukuran pada sistem yang belum memiliki asesmen: organisasi klien, asesor utama di organisasi
 * operator, lalu asesmen. Hanya untuk administrator sistem dan asesor utama Nusa Safety.
 */
async function startSteps(isSuperAdmin: boolean, canCreate: boolean): Promise<StartStep[]> {
  const t = await getTranslations("assessments.start");
  const db = getDb();
  const [operator, clientCount] = await Promise.all([
    db.organization.findFirst({ where: { isOperator: true }, select: { id: true } }),
    db.organization.count({ where: { isOperator: false } }),
  ]);
  const leadCount = operator ? await db.membership.count({ where: { organizationId: operator.id, role: "LEAD_ASSESSOR" } }) : 0;
  return [
    { key: "organization", done: clientCount > 0, href: isSuperAdmin ? "/orgs" : null, hint: isSuperAdmin ? undefined : t("notAllowed") },
    { key: "lead", done: leadCount > 0, href: isSuperAdmin && operator ? `/orgs/${operator.id}` : null, hint: isSuperAdmin ? undefined : t("notAllowed") },
    { key: "assessment", done: false, href: canCreate ? "/assessments/new" : null, hint: canCreate ? undefined : t("assessment.needsLead") },
  ];
}

export default async function AssessmentsPage() {
  const session = await guardPage(() => requireUser());
  const t = await getTranslations("assessments");
  const tAssessment = await getTranslations("assessment");
  const assessments = await listVisibleAssessments(session);
  const canCreate = session.principal.memberships.some((m) => m.organizationIsOperator && m.role === "LEAD_ASSESSOR");
  const showStart = assessments.length === 0 && (session.principal.isSuperAdmin || canCreate);
  const steps = showStart ? await startSteps(session.principal.isSuperAdmin, canCreate) : [];
  const tz = getAppTimeZone();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-brand-navy-deep text-2xl font-bold">{t("title")}</h1>
        {canCreate && !showStart ? (
          <Button asChild>
            <Link href="/assessments/new">
              <UiPlus aria-hidden />
              {tAssessment("newButton")}
            </Link>
          </Button>
        ) : null}
      </div>
      {showStart ? (
        <Card data-testid="start-guide">
          <CardHeader className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>{t("start.title")}</CardTitle>
              <CardDescription>{t("start.intro")}</CardDescription>
            </div>
            <Illustration name="empty-start" priority className="w-40 shrink-0 self-center sm:w-52" />
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {steps.map((step, index) => (
                <li key={step.key} className="flex gap-4" data-testid={`start-step-${step.key}`} data-done={step.done}>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                      step.done ? "border-success bg-success text-white" : "border-brand-navy text-brand-navy",
                    )}
                  >
                    {step.done ? <UiCheckCircle className="size-4" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-semibold">
                      {t(`start.${step.key}.title`)}
                      {step.done ? (
                        <Badge variant="success" className="ml-2 align-middle">
                          {t("start.done")}
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-sm">{t(`start.${step.key}.description`)}</p>
                    {step.href ? (
                      <Button asChild size="sm" variant={step.done ? "outline" : "default"}>
                        <Link href={step.href}>
                          {t(`start.${step.key}.action`)}
                          <UiArrowRight aria-hidden />
                        </Link>
                      </Button>
                    ) : step.hint ? (
                      <p className="text-muted-foreground text-sm italic">{step.hint}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : assessments.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("name")}</TableHeaderCell>
              <TableHeaderCell>{t("organization")}</TableHeaderCell>
              <TableHeaderCell>{t("period")}</TableHeaderCell>
              <TableHeaderCell>{t("phase")}</TableHeaderCell>
              <TableHeaderCell>{t("status")}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {assessments.map((a) => {
              const phase = phaseOf(a.status);
              return (
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
                  <TableCell className="text-sm">
                    {phase === "CLOSED"
                      ? tAssessment("phaseClosed")
                      : tAssessment("phaseLine", { number: PHASES.indexOf(phase) + 1, total: PHASES.length, phase: tAssessment(`phases.${phase}`) })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t(`statuses.${a.status}`)}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
