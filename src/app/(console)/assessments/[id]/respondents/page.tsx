import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { STATUS_ORDER } from "@/lib/assessments/state-machine";
import { guardPage, requireRole, unitWhere } from "@/lib/auth/guard";
import { rolesFor, SURVEY_WINDOW_WRITE_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { listRoster } from "@/lib/respondents/service";
import { DistributionPanel, ImportPanel, RowActions, SurveyWindowForm } from "./respondent-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("respondents") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  q: z.string().trim().max(100).optional().catch(undefined),
  unit: z.string().min(1).max(64).optional().catch(undefined),
});

/** Nilai datetime-local dalam WIB untuk isian formulir. */
function wibInput(date: Date | null): string {
  if (!date) return "";
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export default async function RespondentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = paramsSchema.parse(await params);
  const query = querySchema.parse(await searchParams);
  const access = await guardPage(() => requireRole(id, rolesFor("roster", "read")));
  const t = await getTranslations("respondents");
  const tA = await getTranslations("assessment");
  const db = getDb();

  const assessment = await db.assessment.findUniqueOrThrow({
    where: { id: access.assessmentId, organizationId: access.organizationId },
    select: { status: true, surveyOpensAt: true, surveyClosesAt: true },
  });
  const stage = STATUS_ORDER.indexOf(assessment.status);
  const open = assessment.status === "LOCKED" || assessment.status === "DATA_COLLECTION";
  const beforeLock = stage < STATUS_ORDER.indexOf("LOCKED");

  const has = (roles: readonly string[]) => access.roles.some((r) => roles.includes(r));
  const canImport = open && has(rolesFor("roster", "write"));
  const canDistribute = open && has(rolesFor("tokensAndParticipation", "write"));
  const canSetWindow = open && has(SURVEY_WINDOW_WRITE_ROLES);

  const scope = { assessmentId: access.assessmentId, ...unitWhere(access) };
  const unitFilter = query.unit && (!access.unitScope || access.unitScope.includes(query.unit)) ? query.unit : null;
  const [units, registered, withEmail, tokens, roster] = await Promise.all([
    db.unit.findMany({
      where: { assessmentId: access.assessmentId, ...(access.unitScope ? { id: { in: access.unitScope } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.rosterEntry.count({ where: scope }),
    db.rosterEntry.count({ where: { ...scope, emailEnc: { not: null } } }),
    db.accessToken.count({ where: { ...scope, kind: "SURVEY", revokedAt: null, rosterEntryId: { not: null } } }),
    listRoster(access, { page: query.page, search: query.q, unitId: unitFilter }),
  ]);
  const pages = Math.max(1, Math.ceil(roster.total / roster.pageSize));
  const tz = getAppTimeZone();
  const base = `/assessments/${access.assessmentId}/respondents`;
  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (query.q) sp.set("q", query.q);
    if (unitFilter) sp.set("unit", unitFilter);
    sp.set("page", String(page));
    return `${base}?${sp.toString()}`;
  };

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>
      {beforeLock ? <Alert variant="info">{t("notYetLocked")}</Alert> : null}
      {!beforeLock && !open ? <Alert variant="info">{t("closed")}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("summary.registered"), value: registered, testId: "roster-registered" },
          { label: t("summary.withEmail"), value: withEmail, testId: "roster-with-email" },
          { label: t("summary.tokens"), value: tokens, testId: "roster-tokens" },
        ].map((s) => (
          <Card key={s.testId}>
            <CardContent className="space-y-1 py-4">
              <p className="text-muted-foreground text-sm">{s.label}</p>
              <p className="text-brand-navy text-2xl font-bold tabular-nums" data-testid={s.testId} data-value={s.value}>
                {formatNumber(s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("window.title")}</CardTitle>
          <CardDescription>
            {assessment.surveyOpensAt && assessment.surveyClosesAt
              ? t("window.current", { opens: formatDateTime(assessment.surveyOpensAt, tz), closes: formatDateTime(assessment.surveyClosesAt, tz) })
              : t("window.notSet")}
          </CardDescription>
        </CardHeader>
        {canSetWindow ? (
          <CardContent>
            <SurveyWindowForm
              assessmentId={access.assessmentId}
              opensAt={wibInput(assessment.surveyOpensAt)}
              closesAt={wibInput(assessment.surveyClosesAt)}
            />
          </CardContent>
        ) : null}
      </Card>

      {canImport ? <ImportPanel assessmentId={access.assessmentId} /> : null}
      {canDistribute ? <DistributionPanel assessmentId={access.assessmentId} units={units} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("table.title")}</CardTitle>
          <CardDescription>{t("table.privacy")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" action={base} className="flex flex-wrap items-end gap-3">
            <Input name="q" defaultValue={query.q} placeholder={t("table.search")} aria-label={t("table.search")} className="max-w-xs" />
            <Select name="unit" defaultValue={unitFilter ?? ""} aria-label={t("distribution.unitFilter")} className="max-w-xs">
              <option value="">{t("distribution.allUnits")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              {t("table.apply")}
            </button>
          </form>
          <p className="text-muted-foreground text-sm" data-testid="roster-total">
            {t("table.total", { count: formatNumber(roster.total) })}
          </p>
          {roster.rows.length === 0 ? (
            <p className="text-muted-foreground">{t("table.empty")}</p>
          ) : (
            <Table className="whitespace-nowrap">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("columns.name")}</TableHeaderCell>
                  <TableHeaderCell>{t("columns.employeeNo")}</TableHeaderCell>
                  <TableHeaderCell>{t("columns.unit")}</TableHeaderCell>
                  <TableHeaderCell>{t("columns.stratum")}</TableHeaderCell>
                  <TableHeaderCell>{t("columns.email")}</TableHeaderCell>
                  <TableHeaderCell>{t("columns.contractor")}</TableHeaderCell>
                  <TableHeaderCell>{t("table.token")}</TableHeaderCell>
                  {canDistribute ? <TableHeaderCell>{t("table.actions")}</TableHeaderCell> : null}
                </TableRow>
              </TableHead>
              <tbody>
                {roster.rows.map((r) => (
                  <TableRow key={r.id} data-testid="roster-row">
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.employeeNo ?? ""}</TableCell>
                    <TableCell>{r.unitName}</TableCell>
                    <TableCell className="font-mono">{r.stratumCode}</TableCell>
                    <TableCell className="text-sm">{r.email ?? ""}</TableCell>
                    <TableCell>{r.isContractor ? tA("yes") : tA("no")}</TableCell>
                    <TableCell data-testid="token-state" data-state={r.tokenState}>
                      {t(`table.tokenStates.${r.tokenState}`)}
                    </TableCell>
                    {canDistribute ? (
                      <TableCell>
                        <RowActions assessmentId={access.assessmentId} rosterEntryId={r.id} tokenState={r.tokenState} hasEmail={Boolean(r.email)} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
          {pages > 1 ? (
            <nav className="flex items-center gap-3 text-sm" aria-label={t("table.page", { page: query.page, pages })}>
              {query.page > 1 ? (
                <Link href={pageHref(query.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {t("table.previous")}
                </Link>
              ) : null}
              <span>{t("table.page", { page: query.page, pages })}</span>
              {query.page < pages ? (
                <Link href={pageHref(query.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {t("table.next")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
