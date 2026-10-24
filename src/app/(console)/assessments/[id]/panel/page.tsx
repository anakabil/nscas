import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { RATIONALE_MIN_LENGTH } from "@/lib/assessor-scoring/rules";
import { PANEL_STATUSES, loadPanel } from "@/lib/assessor-scoring/service";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { SCORING_ROLES } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { EngineResult } from "@/lib/scoring";
import { AdjustmentForm, FinalizeForm, RemoveAdjustmentButton } from "./panel-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("panel") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function PanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, SCORING_ROLES.panelRead));
  const t = await getTranslations("panel");
  const tLevels = await getTranslations("assessment.levels");
  const panel = await loadPanel(access.assessmentId);
  if (!panel) {
    return (
      <>
        <p className="text-muted-foreground">{t("intro")}</p>
        <Alert variant="info">{t("noRun")}</Alert>
      </>
    );
  }
  const tz = getAppTimeZone();
  const isLead = access.roles.some((r) => (SCORING_ROLES.panelWrite as readonly string[]).includes(r));
  const canAdjust = isLead && PANEL_STATUSES.includes(panel.status) && !panel.run.isFinal;
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? t("matrix.empty") : formatNumber(v, 2));
  const { current, engine } = panel;
  const reconcile = current.characteristics.filter((c) => c.flags.includes("PERLU_REKONSILIASI"));
  const divergence = current.characteristics.filter((c) => c.flags.includes("SELISIH_PERSEPSI_BUKTI"));
  const aspectCodes = Object.keys(current.aspects);

  const summary = (r: EngineResult, testId: string) => (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm" data-testid={testId}>
      <dt className="text-muted-foreground">{t("summary.index")}</dt>
      <dd className="text-2xl font-bold tabular-nums" data-testid={`${testId}-index`}>
        {formatNumber(r.organization.index, 2)}
      </dd>
      <dt className="text-muted-foreground">{t("summary.level")}</dt>
      <dd>{tLevels(String(r.organization.indicativeLevel))}</dd>
      <dt className="text-muted-foreground">{t("summary.consolidated")}</dt>
      <dd>
        <Badge variant={r.organization.consolidated ? "success" : "warning"}>{r.organization.consolidated ? t("summary.consolidated") : t("summary.notConsolidated")}</Badge>
      </dd>
      <dt className="text-muted-foreground">{t("summary.priority")}</dt>
      <dd>
        {r.organization.priorityAspect} {panel.aspectNames[r.organization.priorityAspect]}
      </dd>
      <dt className="text-muted-foreground">{t("summary.contextual")}</dt>
      <dd className="tabular-nums">{fmt(r.organization.contextualIndex)}</dd>
    </dl>
  );

  return (
    <>
      {panel.run.isFinal ? (
        <Alert variant="success" data-testid="final-ribbon">
          {t("finalRibbon", { time: formatDateTime(panel.run.finalizedAt as Date, tz), name: panel.run.finalizedByName ?? "" })}
        </Alert>
      ) : (
        <div role="note" className="bg-heat-mid text-warning rounded-lg px-4 py-2 text-center font-semibold" data-testid="draft-ribbon">
          {t("draftRibbon")}
        </div>
      )}
      <p className="text-muted-foreground">{t("intro")}</p>
      <p className="text-sm">{t("runInfo", { time: formatDateTime(panel.run.createdAt, tz), name: panel.run.runByName, responses: formatNumber(panel.counts.responses) })}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("summary.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">{t("summary.engine")}</h3>
              {summary(engine, "summary-engine")}
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">{t("summary.current")}</h3>
              {summary(current, "summary-current")}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">{t("summary.aspects")}</h3>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("summary.aspect")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("summary.weight")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("summary.engine")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("summary.current")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("summary.gap")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {aspectCodes.map((code) => (
                  <TableRow key={code} data-testid="aspect-row" data-code={code}>
                    <TableCell>
                      <span className="font-mono">{code}</span> {panel.aspectNames[code]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber((current.aspects[code]?.weight ?? 0) * 100, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(engine.aspects[code]?.index)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(current.aspects[code]?.index)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(current.aspects[code]?.gapToTarget)}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="space-y-1 text-sm" data-testid="scl-track">
            {current.sclTrack ? (
              <>
                <p className="font-semibold">{t("summary.scl", { level: tLevels(String(current.sclTrack.indicativeLevel)) })}</p>
                <ul className="list-disc pl-5">
                  {([2, 3, 4, 5] as const).map((step) => {
                    const s = current.sclTrack!.steps[step];
                    return (
                      <li key={step}>
                        {t("summary.sclStep", { step, average: formatNumber(s.weightedAverage * 100, 1), minimum: formatNumber(s.minimum * 100, 1), result: s.passed ? t("summary.passed") : t("summary.failed") })}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground">{t("summary.sclMissing")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("matrix.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("matrix.characteristic")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("matrix.perception")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("matrix.evidence")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("matrix.validation")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("matrix.combined")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("matrix.final")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("matrix.panel")}</TableHeaderCell>
                <TableHeaderCell>{t("matrix.flags")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {current.characteristics.map((c) => {
                const s = panel.sources[c.code];
                return (
                  <TableRow key={c.code} data-testid="matrix-row" data-code={c.code}>
                    <TableCell>
                      <span className="font-mono font-semibold">{c.code}</span> {panel.names[c.code]}
                      {s ? <p className="text-muted-foreground text-xs">{t("matrix.sources", { answers: s.surveyAnswers, dontKnow: s.dontKnow, assessors: s.evidenceAssessors, sessions: s.validationSessions })}</p> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.perception)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.evidence)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.validation)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.combined)}</TableCell>
                    <TableCell className="text-right tabular-nums" data-testid="matrix-final">
                      {fmt(c.final)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums" data-testid="matrix-panel">
                      {c.panelAdjusted === null ? "" : formatNumber(c.panelAdjusted, 2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.flags.map((f) => (
                          <Badge key={f} variant={f === "SELISIH_PERSEPSI_BUKTI" || f === "PERLU_REKONSILIASI" ? "warning" : "outline"} data-testid="matrix-flag">
                            {t(`flags.${f}`)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("lists.reconcileTitle")}</CardTitle>
            <CardDescription>{t("lists.reconcileIntro")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm" data-testid="reconcile-list">
              {reconcile.length === 0 ? <li className="text-muted-foreground">{t("lists.none")}</li> : null}
              {reconcile.map((c) => (
                <li key={c.code}>{t("lists.reconcileItem", { code: c.code, name: panel.names[c.code] ?? "", min: fmt(panel.sources[c.code]?.evidenceMin), max: fmt(panel.sources[c.code]?.evidenceMax) })}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("lists.divergenceTitle")}</CardTitle>
            <CardDescription>{t("lists.divergenceIntro")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm" data-testid="divergence-list">
              {divergence.length === 0 ? <li className="text-muted-foreground">{t("lists.none")}</li> : null}
              {divergence.map((c) => (
                <li key={c.code}>{t("lists.divergenceItem", { code: c.code, name: panel.names[c.code] ?? "", perception: fmt(c.perception), evidence: fmt(c.evidence), divergence: fmt(c.divergence) })}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("adjust.title")}</CardTitle>
          <CardDescription>{t("adjust.intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-semibold">{t("adjust.list")}</h3>
          <ul className="space-y-3" data-testid="adjustment-list">
            {panel.adjustments.length === 0 ? <li className="text-muted-foreground text-sm">{t("adjust.none")}</li> : null}
            {panel.adjustments.map((a) => (
              <li key={a.code} className="border-border rounded-lg border p-3 text-sm" data-testid="adjustment-item">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t("adjust.item", { code: a.code, engine: formatNumber(a.engineValue, 2), adjusted: formatNumber(a.adjustedValue, 2) })}</span>
                  <span className="text-muted-foreground text-xs">{t("adjust.decided", { name: a.decidedByName, time: formatDateTime(a.decidedAt, tz) })}</span>
                  {canAdjust ? <RemoveAdjustmentButton assessmentId={access.assessmentId} code={a.code} /> : null}
                </div>
                <p className="mt-1 whitespace-pre-line">{a.rationale}</p>
              </li>
            ))}
          </ul>
          {canAdjust ? (
            <AdjustmentForm
              assessmentId={access.assessmentId}
              rationaleMin={RATIONALE_MIN_LENGTH}
              characteristics={engine.characteristics.filter((c) => c.final !== null).map((c) => ({ code: c.code, label: `${c.code} ${panel.names[c.code] ?? ""} (${formatNumber(c.final as number, 2)})` }))}
            />
          ) : null}
        </CardContent>
      </Card>

      {isLead && !panel.run.isFinal ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("finalize.title")}</CardTitle>
            <CardDescription>{t("finalize.intro")}</CardDescription>
          </CardHeader>
          <CardContent>{canAdjust ? <FinalizeForm assessmentId={access.assessmentId} /> : <Alert variant="info">{t("finalize.notAllowed")}</Alert>}</CardContent>
        </Card>
      ) : null}
    </>
  );
}
