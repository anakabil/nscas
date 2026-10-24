import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AssessmentTabs } from "@/components/assessment/assessment-tabs";
import { Badge } from "@/components/ui/badge";
import { loadAssessmentHeader } from "@/lib/assessments/load";
import { configurationReadRoles } from "@/lib/assessments/permissions";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ALL_ROLES, ASSESSMENT_TEAM_ROLES, rolesFor } from "@/lib/auth/roles";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

// docs/05 bagian 2: setiap halaman konsol menampilkan nama organisasi, nama asesmen, dan status di bagian atas.
export default async function AssessmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, ALL_ROLES));
  const assessment = await loadAssessmentHeader(access.assessmentId, access.organizationId);
  const t = await getTranslations();

  const base = `/assessments/${assessment.id}`;
  const canReadConfiguration = access.roles.some((r) => configurationReadRoles(assessment.status).includes(r));
  const has = (roles: readonly string[]) => access.roles.some((r) => roles.includes(r));
  const canReadTeam = has(ASSESSMENT_TEAM_ROLES.read);
  const tabs = [
    { href: base, label: t("assessment.nav.overview"), exact: true },
    ...(canReadConfiguration
      ? [
          { href: `${base}/setup`, label: t("assessment.nav.details"), exact: true },
          { href: `${base}/setup/units`, label: t("assessment.nav.units") },
          { href: `${base}/setup/strata`, label: t("assessment.nav.strata") },
          { href: `${base}/setup/parameters`, label: t("assessment.nav.parameters") },
          { href: `${base}/setup/sampling`, label: t("assessment.nav.sampling") },
        ]
      : []),
    ...(canReadTeam ? [{ href: `${base}/setup/team`, label: t("assessment.nav.team") }] : []),
    ...(has(rolesFor("roster", "read")) ? [{ href: `${base}/respondents`, label: t("assessment.nav.respondents"), exact: true }] : []),
    ...(has(["LEAD_ASSESSOR", "CLIENT_ADMIN"]) ? [{ href: `${base}/respondents/qr`, label: t("assessment.nav.qr") }] : []),
    ...(has(rolesFor("tokensAndParticipation", "read")) ? [{ href: `${base}/participation`, label: t("assessment.nav.participation") }] : []),
    ...(has(rolesFor("selfAssessments", "read")) ? [{ href: `${base}/self-assessments`, label: t("assessment.nav.selfAssessments") }] : []),
    ...(has(rolesFor("evidenceAndObservations", "read"))
      ? [
          { href: `${base}/evidence`, label: t("assessment.nav.evidence") },
          { href: `${base}/observations`, label: t("assessment.nav.observations") },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm" data-testid="assessment-organization">
          {assessment.organization.name}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-brand-navy text-2xl font-bold">{assessment.name}</h1>
          <Badge variant="secondary" data-testid="assessment-status">
            {t(`assessments.statuses.${assessment.status}`)}
          </Badge>
        </div>
      </header>
      <AssessmentTabs tabs={tabs} label={t("assessment.nav.label")} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
