import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { DASHBOARD_ROLES } from "@/lib/auth/roles";
import { loadDashboard } from "@/lib/dashboard/service";
import { getAppTimeZone } from "@/lib/env";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { AspectChart, CharacteristicChart, ComparisonChart } from "./charts";
import { HeatmapTable } from "./heatmap";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("dashboard") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, DASHBOARD_ROLES.read));
  const t = await getTranslations("dashboard");
  const tLevels = await getTranslations("assessment.levels");
  const tCommon = await getTranslations("common");
  const model = await loadDashboard(access.assessmentId, { roles: access.roles, unitScope: access.unitScope });
  if (!model.available) {
    return (
      <Alert variant="info" data-testid="dashboard-unavailable">
        {model.reason === "NOT_FINAL" ? t("notFinal") : t("noResult")}
      </Alert>
    );
  }
  const tz = getAppTimeZone();
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "" : formatNumber(v, 2));
  const showTools = model.audience === "assessor" || model.audience === "client";
  const previous = model.comparison?.previous[0];

  return (
    <>
      {model.run.isFinal ? (
        <p className="text-success text-sm font-semibold" data-testid="final-note">
          {t("finalNote", { time: formatDateTime(model.run.finalizedAt as Date, tz) })}
        </p>
      ) : (
        <div role="note" className="bg-heat-mid text-warning rounded-lg px-4 py-2 text-center font-semibold" data-testid="draft-ribbon">
          {t("draftRibbon")}
        </div>
      )}
      <div className="border-brand-navy bg-tint rounded-xl border px-4 py-3 text-sm" data-testid="standing-statement">
        {tCommon("resultDisclaimer")}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">{t("intro")}</p>
        {showTools ? (
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link href={`/assessments/${access.assessmentId}/dashboard/quality`} className="text-brand-navy underline">
              {t("qualityLink")}
            </Link>
            <a href={`/api/assessments/${access.assessmentId}/dashboard/export`} className="text-brand-navy underline" data-testid="dashboard-export">
              {t("export")}
            </a>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="summary-cards">
        <Card>
          <CardHeader>
            <CardDescription>{t("cards.index")}</CardDescription>
            <CardTitle className="text-4xl tabular-nums" data-testid="card-index">
              {formatNumber(model.summary.index, 2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{tLevels(String(model.summary.level))}</p>
            <Badge variant={model.summary.consolidated ? "success" : "warning"}>{model.summary.consolidated ? t("cards.consolidated") : t("cards.notConsolidated")}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("cards.gap")}</CardDescription>
            <CardTitle className="text-4xl tabular-nums" data-testid="card-gap">
              {formatNumber(model.summary.gapToTarget, 2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{t("cards.target", { target: model.targetLevel })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("cards.priority")}</CardDescription>
            <CardTitle className="text-2xl" data-testid="card-priority">
              {model.summary.priorityAspect}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{model.summary.priorityAspectName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("cards.level")}</CardDescription>
            <CardTitle className="text-2xl">{tLevels(String(model.summary.level))}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {model.summary.sclLevel ? <p>{t("cards.scl", { level: tLevels(String(model.summary.sclLevel)) })}</p> : null}
            {model.summary.contextualIndex !== null ? <p>{t("cards.contextual", { value: formatNumber(model.summary.contextualIndex, 2) })}</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("charts.aspects")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AspectChart data={model.aspects} target={model.targetLevel} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("charts.characteristics")}</CardTitle>
            <CardDescription>
              {t("charts.contextual")}. {model.characteristics.some((c) => c.adjusted) ? t("charts.adjusted") : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CharacteristicChart data={model.characteristics} target={model.targetLevel} />
          </CardContent>
        </Card>
      </div>

      {model.heatmaps?.strata ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("heatmap.strataTitle")}</CardTitle>
            <CardDescription>{t("heatmap.intro")}</CardDescription>
          </CardHeader>
          <CardContent>
            <HeatmapTable heatmap={model.heatmaps.strata} testId="heatmap-strata" />
          </CardContent>
        </Card>
      ) : null}
      {model.heatmaps?.units ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("heatmap.unitsTitle")}</CardTitle>
            <CardDescription>{t("heatmap.intro")}</CardDescription>
          </CardHeader>
          <CardContent>
            <HeatmapTable heatmap={model.heatmaps.units} testId="heatmap-units" />
          </CardContent>
        </Card>
      ) : null}

      {model.divergence ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("divergence.title")}</CardTitle>
            <CardDescription>{t("divergence.intro")}</CardDescription>
          </CardHeader>
          <CardContent>
            {model.divergence.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("divergence.none")}</p>
            ) : (
              <Table data-testid="divergence-table">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("divergence.characteristic")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("divergence.perception")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("divergence.evidence")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("divergence.final")}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <tbody>
                  {model.divergence.map((d) => (
                    <TableRow key={d.code} data-testid="divergence-row">
                      <TableCell>
                        <span className="font-mono font-semibold">{d.code}</span> {d.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.perceptionHidden ? <span className="text-muted-foreground">{t("divergence.hidden")}</span> : fmt(d.perception)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(d.evidence)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(d.final)}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {model.perceptionGap ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("gap.title")}</CardTitle>
            <CardDescription>{t("gap.intro")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="gap-table">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("gap.aspect")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("gap.management")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("gap.field")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("gap.difference")}</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHead>
              <tbody>
                {model.perceptionGap.map((g) => (
                  <TableRow key={g.code} data-testid="gap-row" data-code={g.code}>
                    <TableCell>
                      <span className="font-mono font-semibold">{g.code}</span> {g.name}
                    </TableCell>
                    {g.suppressed ? (
                      <TableCell colSpan={4} className="text-muted-foreground text-sm">
                        {t("gap.hidden")}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="text-right tabular-nums">{fmt(g.management)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(g.field)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{fmt(g.gap)}</TableCell>
                        <TableCell>{g.attention ? <Badge variant="warning">{t("gap.attention")}</Badge> : null}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {model.comparison && previous ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("comparison.title")}</CardTitle>
            <CardDescription>{t("comparison.intro")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table data-testid="comparison-table">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("comparison.assessment")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("comparison.index")}</TableHeaderCell>
                  <TableHeaderCell>{t("comparison.level")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("comparison.change")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                <TableRow>
                  <TableCell className="font-semibold">{t("comparison.current")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(model.summary.index, 2)}</TableCell>
                  <TableCell>{tLevels(String(model.summary.level))}</TableCell>
                  <TableCell />
                </TableRow>
                {model.comparison.previous.map((p, i) => {
                  const later = i === 0 ? model.summary.index : (model.comparison?.previous[i - 1]?.index ?? null);
                  return (
                    <TableRow key={p.id} data-testid="comparison-row">
                      <TableCell>
                        {p.name}
                        <span className="text-muted-foreground block text-xs">
                          {t("comparison.period", { start: formatDate(p.periodStart, tz), end: formatDate(p.periodEnd, tz) })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.index, 2)}</TableCell>
                      <TableCell>{tLevels(String(p.level))}</TableCell>
                      <TableCell className="text-right tabular-nums">{later === null ? "" : `${later - p.index >= 0 ? "+" : ""}${formatNumber(later - p.index, 2)}`}</TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
            <ComparisonChart
              data={model.aspects.map((a) => ({ code: a.code, previous: previous.aspects[a.code] ?? null, current: model.comparison?.current.aspects[a.code] ?? null }))}
              labels={{ previous: previous.name, current: t("comparison.current") }}
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
