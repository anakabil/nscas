"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { samplePlan } from "@/lib/scoring/sampling";
import { saveSamplePlanAction } from "../actions";

export interface CalculatorSettings {
  z: number;
  marginOfError: number;
  proportion: number;
  minParticipationPerStratum: number;
  sclInterviewFactorManagement: number;
  sclInterviewFactorOperational: number;
  sclProjectFactor: number;
}

const nf = (value: number, digits = 0) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

function wholeNumber(text: string): number {
  const n = Number(text.replace(/[.,\s]/g, ""));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Kalkulator sampel interaktif (lembar 09 kertas kerja). Perhitungan memakai src/lib/scoring/sampling.ts. */
export function SampleCalculator({
  assessmentId,
  strata,
  defaults,
  settings,
  editable,
}: {
  assessmentId: string;
  strata: { code: string; name: string; population: number }[];
  defaults: { projects: number; locations: number };
  settings: CalculatorSettings;
  editable: boolean;
}) {
  const t = useTranslations("assessment.sampling");
  const tCommon = useTranslations("assessment");
  const [projects, setProjects] = useState(String(defaults.projects));
  const [locations, setLocations] = useState(String(defaults.locations));
  const [state, formAction] = useActionState(saveSamplePlanAction.bind(null, assessmentId), initialActionState);

  const workers = strata.reduce((s, r) => s + r.population, 0);
  const plan = useMemo(() => {
    if (workers < 1) return null;
    return samplePlan({
      workers,
      projects: wholeNumber(projects),
      locations: wholeNumber(locations),
      strata,
      z: settings.z,
      marginOfError: settings.marginOfError,
      proportion: settings.proportion,
      minParticipation: settings.minParticipationPerStratum,
      interviewFactorManagement: settings.sclInterviewFactorManagement,
      interviewFactorOperational: settings.sclInterviewFactorOperational,
      projectFactor: settings.sclProjectFactor,
    });
  }, [workers, projects, locations, strata, settings]);

  const rows = plan
    ? ([
        ["interviewManagement", plan.sclMinimumInterviewManagement],
        ["interviewOperational", plan.sclMinimumInterviewOperational],
        ["interviewTotal", plan.sclMinimumInterviewTotal],
        ["slovin", plan.slovin],
        ["cochranInitial", plan.cochranInitial],
        ["cochranCorrected", plan.cochranCorrected],
        ["recommended", plan.recommendedSurvey],
        ["projectsToVisit", plan.projectsToVisit],
        ["locationsToVisit", plan.locationsToVisit],
      ] as const)
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("inputs")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="workers">{t("workers")}</Label>
              <Input id="workers" value={nf(workers)} readOnly className="bg-surface-alt tabular-nums" />
              <FieldHint>{t("workersHint")}</FieldHint>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projects">{t("projects")}</Label>
              <Input id="projects" value={projects} onChange={(e) => setProjects(e.target.value)} inputMode="numeric" disabled={!editable} className="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locations">{t("locations")}</Label>
              <Input id="locations" value={locations} onChange={(e) => setLocations(e.target.value)} inputMode="numeric" disabled={!editable} className="tabular-nums" />
            </div>
          </div>
          <FieldHint>
            {t("settings", {
              z: nf(settings.z, 2),
              e: nf(settings.marginOfError, 2),
              p: nf(settings.proportion, 2),
              min: nf(settings.minParticipationPerStratum, 2),
            })}
          </FieldHint>
        </CardContent>
      </Card>

      {!plan ? <Alert variant="warning">{t("noPopulation")}</Alert> : null}

      {plan ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-bold">{t("minimumTitle")}</h2>
            <Table data-testid="sample-minimum">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("item")}</TableHeaderCell>
                  <TableHeaderCell>{t("formula")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("result")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {rows.map(([key, value]) => (
                  <TableRow key={key} data-testid={`sample-${key}`} className={key === "recommended" ? "bg-tint font-semibold" : undefined}>
                    <TableCell>{t(key)}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{t(`formulas.${key}`)}</TableCell>
                    <TableCell className="text-right tabular-nums" data-value={value}>
                      {key === "cochranInitial" ? nf(value, 2) : nf(value)}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            <FieldHint>{t("roundingNote")}</FieldHint>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">{t("strataTitle")}</h2>
            <FieldHint>{t("formulas.stratumTarget")}</FieldHint>
            <Table data-testid="sample-strata">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tCommon("strata.code")}</TableHeaderCell>
                  <TableHeaderCell>{tCommon("strata.name")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{tCommon("strata.population")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("proportionCol")}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{t("target")}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {plan.strata.map((s) => (
                  <TableRow key={s.code}>
                    <TableCell className="font-mono">{s.code}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf(s.population)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf(s.proportion * 100, 2)}%</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums" data-testid={`sample-target-${s.code}`}>
                      {nf(s.surveyTarget)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-tint font-semibold">
                  <TableCell colSpan={2}>{t("total")}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(workers)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(100, 2)}%</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="sample-target-total" data-value={plan.surveyTargetTotal}>
                    {nf(plan.surveyTargetTotal)}
                  </TableCell>
                </TableRow>
              </tbody>
            </Table>
          </section>

          {editable ? (
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="projects" value={wholeNumber(projects)} />
              <input type="hidden" name="locations" value={wholeNumber(locations)} />
              {state.error ? <Alert variant="destructive">{tCommon(`errors.${state.error}`)}</Alert> : null}
              {state.success ? <Alert variant="success">{t("saved")}</Alert> : null}
              <SubmitButton pendingLabel={tCommon("saving")}>{t("save")}</SubmitButton>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
