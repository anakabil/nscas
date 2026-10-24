import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { RUN_STATUSES, lastInputChange, listScoreRuns, loadRatingOverview, loadScl } from "@/lib/assessor-scoring/service";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { SCORING_ROLES } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { RunEngineButton } from "./scoring-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("scoring") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function ScoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, SCORING_ROLES.read));
  const t = await getTranslations("scoring");
  const tLevels = await getTranslations("assessment.levels");
  const [overview, scl, runs, changedAt] = await Promise.all([
    loadRatingOverview(access.assessmentId, access.session.user.id),
    loadScl(access.assessmentId).catch(() => null),
    listScoreRuns(access.assessmentId),
    lastInputChange(access.assessmentId),
  ]);
  const has = (roles: readonly string[]) => access.roles.some((r) => roles.includes(r));
  const canRun = RUN_STATUSES.includes(overview.status) && has(SCORING_ROLES.run);
  const tz = getAppTimeZone();
  const covered = overview.characteristics.filter((c) => c.raters >= 2).length;
  const latest = runs[0];
  const stale = Boolean(latest && changedAt && changedAt > latest.createdAt && !latest.isFinal);

  return (
    <>
      <p className="text-muted-foreground">{t("intro")}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.title")}</CardTitle>
          <CardDescription data-testid="rating-coverage">{t("list.coverage", { count: covered, total: overview.characteristics.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("list.code")}</TableHeaderCell>
                <TableHeaderCell>{t("list.name")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("list.own")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("list.raters")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("list.evidence")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {overview.characteristics.map((c) => (
                <TableRow key={c.id} data-testid="rating-row" data-code={c.code}>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell>
                    <Link href={`/assessments/${access.assessmentId}/scoring/${c.code}`} className="text-brand-navy font-semibold underline" aria-label={t("list.open", { code: c.code })}>
                      {c.name}
                    </Link>
                    {c.isContextual ? (
                      <Badge variant="outline" className="ml-2">
                        {t("contextual")}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="rating-own">
                    {c.ownLevel === null ? <span className="text-muted-foreground">{t("list.notRated")}</span> : formatNumber(c.ownLevel, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="rating-raters">
                    {formatNumber(c.raters)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(c.evidence)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("scl.title")}</CardTitle>
          <CardDescription>{t("scl.intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {scl ? <Alert variant={scl.complete ? "success" : "info"}>{scl.complete ? t("scl.complete") : t("scl.incomplete")}</Alert> : null}
          <Link href={`/assessments/${access.assessmentId}/scoring/scl`} className="text-brand-navy text-sm font-semibold underline">
            {t("scl.link")}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("run.title")}</CardTitle>
          <CardDescription>{t("run.intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stale && RUN_STATUSES.includes(overview.status) ? <Alert variant="warning">{t("run.stale")}</Alert> : null}
          {canRun ? <RunEngineButton assessmentId={access.assessmentId} /> : has(SCORING_ROLES.run) && runs.length === 0 ? <p className="text-muted-foreground text-sm">{t("run.notAllowed")}</p> : null}
          <h3 className="font-semibold">{t("run.history")}</h3>
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("run.none")}</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("run.at")}</TableHeaderCell>
                  <TableHeaderCell>{t("run.by")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("run.index")}</TableHeaderCell>
                  <TableHeaderCell>{t("run.level")}</TableHeaderCell>
                  <TableHeaderCell>{t("run.state")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {runs.map((r) => (
                  <TableRow key={r.id} data-testid="run-row">
                    <TableCell>{formatDateTime(r.createdAt, tz)}</TableCell>
                    <TableCell>{r.runByName}</TableCell>
                    <TableCell className="text-right tabular-nums" data-testid="run-index">
                      {formatNumber(r.index, 2)}
                    </TableCell>
                    <TableCell>{tLevels(String(r.level))}</TableCell>
                    <TableCell>
                      <Badge variant={r.isFinal ? "success" : "secondary"}>{r.isFinal ? t("run.final") : t("run.draft")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
          {runs.length > 0 ? (
            <Link href={`/assessments/${access.assessmentId}/panel`} className="text-brand-navy text-sm font-semibold underline">
              {t("run.toPanel")}
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
