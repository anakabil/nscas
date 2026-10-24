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
import { EXCLUSION_STATUSES, loadQuality } from "@/lib/dashboard/service";
import { formatDate, formatNumber } from "@/lib/format";
import { ExclusionForm } from "./exclusion-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.quality");
  return { title: t("title") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });
const percent = (v: number | null) => (v === null ? "" : `${formatNumber(v * 100, 1)}%`);

export default async function QualityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, DASHBOARD_ROLES.quality));
  const t = await getTranslations("dashboard");
  const isAssessor = access.roles.some((r) => (DASHBOARD_ROLES.exclude as readonly string[]).includes(r));
  const q = await loadQuality(access.assessmentId, { includeResponses: isAssessor });
  if (!q) return <Alert variant="info">{t("noResult")}</Alert>;
  const canExclude = isAssessor && EXCLUSION_STATUSES.includes(q.status);
  const p = q.participation.summary;

  return (
    <>
      <Link href={`/assessments/${access.assessmentId}/dashboard`} className="text-brand-navy text-sm font-semibold underline">
        {t("back")}
      </Link>
      <p className="text-muted-foreground">{t("quality.intro")}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("quality.participation")}</CardTitle>
          <CardDescription>
            {t("quality.analysed", { count: formatNumber(q.counts.analysed) })} · {t("quality.excluded", { count: formatNumber(q.counts.excluded) })} · {t("quality.flagged", { count: formatNumber(q.counts.flagged) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="quality-participation">
            <TableHead>
              <TableRow>
                <TableHeaderCell />
                <TableHeaderCell className="text-right">{t("quality.population")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("quality.completed")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("quality.rate")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {p.strata.map((s) => (
                <TableRow key={s.stratumId}>
                  <TableCell>
                    <span className="font-mono">{s.code}</span> {s.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(s.population)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.completed.suppressed ? <span className="text-muted-foreground">{t("quality.hidden")}</span> : formatNumber(s.completed.value ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(s.rate)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("quality.alpha")}</CardTitle>
            <CardDescription>{t("quality.alphaIntro", { min: formatNumber(q.alphaMin, 2) })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="quality-alpha">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("quality.dimension")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("quality.value")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("quality.respondents")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {q.alpha.map((a) => (
                  <TableRow key={a.code}>
                    <TableCell>
                      <span className="font-mono">{a.code}</span> {a.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.alpha.value === null ? <span className="text-muted-foreground">{t("quality.hidden")}</span> : formatNumber(a.alpha.value, 2)}
                      {a.belowThreshold ? (
                        <Badge variant="warning" className="ml-2">
                          {t("quality.below")}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.alpha.n === null ? "" : formatNumber(a.alpha.n)}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("quality.rwg")}</CardTitle>
            <CardDescription>{t("quality.rwgIntro", { min: formatNumber(q.rwgMin, 2) })}</CardDescription>
          </CardHeader>
          <CardContent>
            {q.rwg.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("quality.noUnits")}</p>
            ) : (
              <Table data-testid="quality-rwg">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("quality.unit")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("quality.average")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("quality.respondents")}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <tbody>
                  {q.rwg.map((u) => (
                    <TableRow key={u.unitId} data-testid="rwg-row">
                      <TableCell>{u.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u.average === null ? <span className="text-muted-foreground">{t("quality.hidden")}</span> : formatNumber(u.average, 2)}
                        {u.belowThreshold ? (
                          <Badge variant="warning" className="ml-2">
                            {t("quality.below")}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.n === null ? "" : formatNumber(u.n)}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {isAssessor ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("quality.responses")}</CardTitle>
            <CardDescription>{t("quality.responsesIntro")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canExclude ? <Alert variant="info">{t("quality.closed")}</Alert> : <p className="text-muted-foreground text-sm">{t("quality.rerun")}</p>}
            {q.flagged.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("quality.noFlagged")}</p>
            ) : (
              <Table data-testid="flagged-table">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t("quality.code")}</TableHeaderCell>
                    <TableHeaderCell>{t("quality.flags")}</TableHeaderCell>
                    <TableHeaderCell>{t("quality.date")}</TableHeaderCell>
                    <TableHeaderCell>{t("quality.duration")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("quality.dontKnow")}</TableHeaderCell>
                    <TableHeaderCell className="text-right">{t("quality.uniform")}</TableHeaderCell>
                    <TableHeaderCell>{t("quality.state")}</TableHeaderCell>
                    {canExclude ? <TableHeaderCell /> : null}
                  </TableRow>
                </TableHead>
                <tbody>
                  {q.flagged.map((r) => {
                    const code = r.id.slice(0, 8);
                    return (
                      <TableRow key={r.id} data-testid="flagged-row" data-code={code} data-excluded={r.excluded ? "true" : "false"}>
                        <TableCell className="font-mono">{code}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {r.flags.map((f) => (
                              <Badge key={f} variant="warning">
                                {t(`flags.${f}`)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(r.submittedOn, "UTC")}</TableCell>
                        <TableCell>{t(`durations.${r.durationBucket}`)}</TableCell>
                        <TableCell className="text-right tabular-nums">{percent(r.dontKnowShare)}</TableCell>
                        <TableCell className="text-right tabular-nums">{percent(r.climateModeShare)}</TableCell>
                        <TableCell>
                          {r.excluded ? <Badge variant="destructive">{t("quality.excludedState")}</Badge> : <Badge variant="secondary">{t("quality.included")}</Badge>}
                          {r.excludedReason ? <p className="text-muted-foreground mt-1 text-xs">{r.excludedReason}</p> : null}
                        </TableCell>
                        {canExclude ? (
                          <TableCell>
                            <ExclusionForm assessmentId={access.assessmentId} responseId={r.id} code={code} excluded={r.excluded} />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
