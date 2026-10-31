import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AssessmentNav, type AssessmentNavGroup } from "@/components/assessment/assessment-nav";
import { Badge } from "@/components/ui/badge";
import { loadAssessmentHeader } from "@/lib/assessments/load";
import { configurationReadRoles } from "@/lib/assessments/permissions";
import { PHASES, phaseOf, phaseState, type WorkflowPhase } from "@/lib/assessments/workflow";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ACTION_PLAN_ROLES, ALL_ROLES, AUDIT_ROLES, ASSESSMENT_TEAM_ROLES, DASHBOARD_ROLES, REPORT_ROLES, rolesFor, SCORING_ROLES, VALIDATION_ROLES } from "@/lib/auth/roles";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

// docs/05 bagian 2: setiap halaman konsol menampilkan nama organisasi, nama asesmen, status, dan tahap di bagian atas.
// Navigasi dikelompokkan per tahap alur kerja agar pengguna tahu halaman mana yang relevan saat ini.
export default async function AssessmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, ALL_ROLES));
  const assessment = await loadAssessmentHeader(access.assessmentId, access.organizationId);
  const t = await getTranslations();

  const base = `/assessments/${assessment.id}`;
  const canReadConfiguration = access.roles.some((r) => configurationReadRoles(assessment.status).includes(r));
  const has = (roles: readonly string[]) => access.roles.some((r) => roles.includes(r));
  const canReadTeam = has(ASSESSMENT_TEAM_ROLES.read);
  const item = (href: string, key: string, exact = false) => ({ href, label: t(`assessment.nav.${key}`), exact });
  const sections: { key: WorkflowPhase | "OTHER"; items: { href: string; label: string; exact: boolean }[] }[] = [
    {
      key: "PREPARATION",
      items: [
        ...(canReadConfiguration
          ? [
              item(`${base}/setup`, "details", true),
              item(`${base}/setup/units`, "units"),
              item(`${base}/setup/strata`, "strata"),
              item(`${base}/setup/parameters`, "parameters"),
              item(`${base}/setup/sampling`, "sampling"),
            ]
          : []),
        ...(canReadTeam ? [item(`${base}/setup/team`, "team")] : []),
      ],
    },
    {
      key: "DATA_COLLECTION",
      items: [
        ...(has(rolesFor("roster", "read")) ? [item(`${base}/respondents`, "respondents", true)] : []),
        ...(has(["LEAD_ASSESSOR", "CLIENT_ADMIN"]) ? [item(`${base}/respondents/qr`, "qr")] : []),
        ...(has(rolesFor("tokensAndParticipation", "read")) ? [item(`${base}/participation`, "participation")] : []),
        ...(has(rolesFor("selfAssessments", "read")) ? [item(`${base}/self-assessments`, "selfAssessments")] : []),
        ...(has(rolesFor("evidenceAndObservations", "read")) ? [item(`${base}/evidence`, "evidence"), item(`${base}/observations`, "observations")] : []),
        ...(has(VALIDATION_ROLES.read) ? [item(`${base}/validation`, "validation")] : []),
      ],
    },
    {
      key: "SCORING",
      items: [
        ...(has(SCORING_ROLES.read) ? [item(`${base}/scoring`, "scoring")] : []),
        ...(has(SCORING_ROLES.panelRead) ? [item(`${base}/panel`, "panel")] : []),
      ],
    },
    {
      key: "RESULTS",
      items: [
        ...(has(DASHBOARD_ROLES.read) ? [item(`${base}/dashboard`, "dashboard")] : []),
        ...(has(ACTION_PLAN_ROLES.read) ? [item(`${base}/gaps`, "gaps")] : []),
        ...(has(REPORT_ROLES.read) ? [item(`${base}/report`, "report")] : []),
      ],
    },
    { key: "OTHER", items: has(AUDIT_ROLES.read) ? [item(`${base}/audit`, "audit")] : [] },
  ];
  const groups: AssessmentNavGroup[] = [
    { key: "overview", items: [item(base, "overview", true)] },
    ...sections
      .filter((section) => section.items.length > 0)
      .map((section) => {
        if (section.key === "OTHER") return { key: section.key, title: t("assessment.phases.OTHER"), items: section.items };
        const state = phaseState(section.key, assessment.status);
        const number = PHASES.indexOf(section.key) + 1;
        return {
          key: section.key,
          title: `${number}. ${t(`assessment.phases.${section.key}`)}`,
          state,
          stateLabel: t(`assessment.phaseStates.${state}`),
          items: section.items,
        };
      }),
  ];
  const phase = phaseOf(assessment.status);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-muted-foreground text-sm" data-testid="assessment-organization">
          {assessment.organization.name}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-brand-navy-deep text-2xl font-bold">{assessment.name}</h1>
          <Badge variant="secondary" data-testid="assessment-status">
            {t(`assessments.statuses.${assessment.status}`)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm" data-testid="assessment-phase">
          {phase === "CLOSED"
            ? t("assessment.phaseClosed")
            : t("assessment.phaseLine", { number: PHASES.indexOf(phase) + 1, total: PHASES.length, phase: t(`assessment.phases.${phase}`) })}
        </p>
      </header>
      <div className="space-y-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:space-y-0">
        <AssessmentNav groups={groups} label={t("assessment.nav.label")} menuLabel={t("assessment.nav.menu")} />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
