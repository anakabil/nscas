import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PhaseStepper } from "@/components/assessment/phase-stepper";
import { QuickAccess } from "@/components/assessment/quick-access";
import { TransitionPanel, type TransitionView } from "@/components/assessment/transition-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAssessmentHeader, loadEffectiveParameters } from "@/lib/assessments/load";
import { gatherTransitionFacts } from "@/lib/assessments/service";
import { evaluateTransition, nextTransitions } from "@/lib/assessments/state-machine";
import { assessmentNavGroups, quickAccessItems } from "@/lib/assessments/nav";
import { CONDITION_PAGE, conditionHref, PHASES, phaseOf, phaseState } from "@/lib/assessments/workflow";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ALL_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.nav");
  return { title: t("overview") };
}

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export default async function AssessmentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, ALL_ROLES));
  const t = await getTranslations();
  const tz = getAppTimeZone();
  const db = getDb();

  const assessment = await loadAssessmentHeader(access.assessmentId, access.organizationId);
  const [unitCounts, strata, effective, facts] = await Promise.all([
    db.unit.groupBy({ by: ["type"], where: { assessmentId: access.assessmentId }, _count: { _all: true } }),
    db.stratum.aggregate({ where: { assessmentId: access.assessmentId }, _sum: { population: true } }),
    loadEffectiveParameters(access.assessmentId),
    gatherTransitionFacts(db, access.assessmentId),
  ]);
  const unitTotal = unitCounts.reduce((s, g) => s + g._count._all, 0);
  const projectTotal = unitCounts.find((g) => g.type === "PROJECT")?._count._all ?? 0;
  const units =
    access.unitScope === null
      ? null
      : await db.unit.findMany({ where: { assessmentId: access.assessmentId, id: { in: access.unitScope } }, select: { name: true }, orderBy: { name: "asc" } });

  const transitions: TransitionView[] = nextTransitions(assessment.status).map((definition) => {
    const evaluation = evaluateTransition(definition, facts);
    return {
      to: definition.to,
      label: definition.to === "LOCKED" ? t("assessment.overview.lockButton") : t("assessment.overview.moveTo", { status: t(`assessments.statuses.${definition.to}`) }),
      conditions: evaluation.conditions.map((c) => {
        const page = CONDITION_PAGE[c.code];
        const pageLabel = page === "retention" ? t("nav.retention") : t(`assessment.nav.${page}`);
        return {
          code: c.code,
          label: t(`assessment.conditions.${c.code}`),
          met: c.met,
          href: conditionHref(access.assessmentId, c.code),
          linkLabel: t("assessment.overview.openPage", { page: pageLabel }),
        };
      }),
      allowed: evaluation.allowed,
      canAct: definition.actorRoles.some((r) => access.roles.includes(r)),
      actorLabel: definition.actorRoles.map((r) => t(`roles.${r}`)).join(", "),
      warning: definition.to === "LOCKED" ? t("assessment.overview.lockWarning") : undefined,
    };
  });

  const sampleTarget = effective.parameters?.samplePlan?.result.surveyTargetTotal;
  const currentPhase = phaseOf(assessment.status);
  const phases = PHASES.map((phase) => {
    const state = phaseState(phase, assessment.status);
    return {
      key: phase,
      label: t(`assessment.phases.${phase}`),
      state,
      stateLabel: t(`assessment.phaseStates.${state}`),
      detail: phase === currentPhase ? t("assessment.overview.currentStatus", { status: t(`assessments.statuses.${assessment.status}`) }) : undefined,
    };
  });

  const quick = quickAccessItems(assessmentNavGroups(access.assessmentId, assessment.status, access.roles), assessment.status);
  const quickTiles = (quick?.items ?? [])
    .filter((item) => item.page !== "overview")
    .map((item) => ({ page: item.page, href: item.href, label: t(`assessment.nav.${item.page}`), hint: t(`assessment.navHints.${item.page}`) }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("assessment.overview.progressTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PhaseStepper phases={phases} label={t("assessment.overview.progressTitle")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("assessment.overview.nextSteps")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm" data-testid="assessment-guide">
            {t(`assessment.guide.${assessment.status}`)}
          </p>
          {transitions.length === 0 ? <p className="text-muted-foreground text-sm">{t("assessment.overview.noTransition")}</p> : null}
          {transitions.map((transition) => (
            <TransitionPanel key={transition.to} assessmentId={access.assessmentId} transition={transition} />
          ))}
        </CardContent>
      </Card>

      {quick && quickTiles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("assessment.overview.quickAccess", { phase: t(`assessment.phases.${quick.phase}`) })}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickAccess tiles={quickTiles} label={t("assessment.overview.quickAccess", { phase: t(`assessment.phases.${quick.phase}`) })} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("assessment.overview.detailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <dt className="text-muted-foreground text-sm">{t("assessment.overview.period")}</dt>
            <dd>{t("assessments.periodRange", { start: formatDate(assessment.periodStart, tz), end: formatDate(assessment.periodEnd, tz) })}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessment.fields.scopeType")}</dt>
            <dd>{t(`assessment.scopes.${assessment.scopeType}`)}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessments.targetLevel")}</dt>
            <dd>{t(`assessment.levels.${assessment.targetLevel}`)}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessment.overview.instrument")}</dt>
            <dd>{assessment.instrumentVersion.code}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessment.overview.units")}</dt>
            <dd>{t("assessment.units.summary", { count: formatNumber(unitTotal), projects: formatNumber(projectTotal) })}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessment.overview.workers")}</dt>
            <dd className="tabular-nums">{formatNumber(strata._sum.population ?? 0)}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessment.overview.sampleTarget")}</dt>
            <dd className="tabular-nums" data-testid="overview-sample-target">
              {sampleTarget !== undefined ? formatNumber(sampleTarget) : t("assessment.overview.notSet")}
            </dd>
            <dt className="text-muted-foreground text-sm">{t("assessment.overview.lockedAt")}</dt>
            <dd>{assessment.lockedAt ? formatDateTime(assessment.lockedAt, tz) : t("assessment.overview.notLocked")}</dd>
            <dt className="text-muted-foreground text-sm">{t("assessments.yourRoles")}</dt>
            <dd className="flex flex-wrap gap-2" data-testid="assessment-roles">
              {access.roles.map((r) => (
                <Badge key={r} variant="outline">
                  {t(`roles.${r}`)}
                </Badge>
              ))}
            </dd>
            <dt className="text-muted-foreground text-sm">{t("assessments.unitScope")}</dt>
            <dd>{units === null ? t("assessments.allUnits") : units.map((u) => u.name).join(", ")}</dd>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
