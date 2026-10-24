import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { formatNumber } from "@/lib/format";
import type { MaskedCount } from "@/lib/respondents/participation";
import { loadParticipation } from "@/lib/respondents/participation-data";
import { TrendChart } from "./trend-chart";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("participation") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function ParticipationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, rolesFor("tokensAndParticipation", "read")));
  const t = await getTranslations("participation");
  // Koordinator unit hanya melihat unitnya; strata dan perkembangan harian bersifat lintas unit.
  const unitOnly = access.unitScope !== null;
  const { summary, minParticipation, minCell, trend } = await loadParticipation(access.assessmentId, access.unitScope);

  const percent = (rate: number | null) => (rate === null ? t("notAvailable") : t("percent", { value: formatNumber(rate * 100, 1) }));
  const count = (c: MaskedCount) => (c.suppressed ? t("suppressed", { min: minCell }) : formatNumber(c.value ?? 0));
  const minLabel = t("percent", { value: formatNumber(minParticipation * 100) });

  return (
    <>
      <p className="text-muted-foreground">{t("intro", { min: minCell })}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ...(unitOnly ? [] : [{ id: "population", label: t("totals.population"), value: formatNumber(summary.totals.population) }]),
          { id: "registered", label: t("totals.registered"), value: formatNumber(summary.totals.registered) },
          { id: "issued", label: t("totals.issued"), value: formatNumber(summary.totals.issued) },
          { id: "completed", label: t("totals.completed"), value: count(summary.totals.completed) },
          ...(unitOnly ? [] : [{ id: "rate", label: t("totals.rate"), value: percent(summary.totals.rate) }]),
        ].map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-1 py-4">
              <p className="text-muted-foreground text-sm">{s.label}</p>
              <p className="text-brand-navy text-xl font-bold tabular-nums" data-testid={`participation-${s.id}`}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {unitOnly ? null : (
        <Card>
          <CardHeader>
            <CardTitle>{t("strata.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={summary.strataBelowMinimum > 0 ? "warning" : "success"} data-testid="strata-below-count" data-count={summary.strataBelowMinimum}>
              {summary.strataBelowMinimum > 0
                ? t("belowCount", { count: summary.strataBelowMinimum, min: minLabel })
                : t("allAbove", { min: minLabel })}
            </Alert>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("strata.code")}</TableHeaderCell>
                  <TableHeaderCell>{t("strata.name")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("strata.population")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("strata.registered")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("strata.completed")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("strata.rate")}</TableHeaderCell>
                  <TableHeaderCell>{t("strata.status")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {summary.strata.map((s) => (
                  <TableRow key={s.stratumId} data-testid="participation-stratum" data-code={s.code} data-below={s.belowMinimum}>
                    <TableCell className="font-mono">{s.code}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(s.population)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(s.registered)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(s.completed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent(s.rate)}</TableCell>
                    <TableCell>
                      {s.belowMinimum ? (
                        <Badge variant="warning">{t("strata.below", { min: minLabel })}</Badge>
                      ) : (
                        <Badge variant="success">{t("strata.ok")}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            {summary.pendingStratumSelection > 0 ? (
              <p className="text-muted-foreground text-sm">{t("pendingStratum", { count: formatNumber(summary.pendingStratumSelection) })}</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("units.title")}</CardTitle>
          <CardDescription>{t("units.note")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("units.name")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("units.registered")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("units.issued")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("units.completed")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("units.rate")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {summary.units.map((u) => (
                <TableRow key={u.unitId} data-testid="participation-unit" data-name={u.name}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(u.registered)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(u.issued)}</TableCell>
                  <TableCell className="text-right tabular-nums">{count(u.completed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(u.rate)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {unitOnly ? null : (
        <Card>
          <CardHeader>
            <CardTitle>{t("trend.title")}</CardTitle>
            <CardDescription>{t("trend.intro")}</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-muted-foreground">{t("trend.empty")}</p>
            ) : (
              <TrendChart
                points={trend.map((p) => ({ date: p.date, rate: p.rate === null ? null : p.rate * 100 }))}
                minParticipation={minParticipation * 100}
              />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
