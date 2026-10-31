import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AssessmentNav, type AssessmentNavGroup } from "@/components/assessment/assessment-nav";
import { Badge } from "@/components/ui/badge";
import { loadAssessmentHeader } from "@/lib/assessments/load";
import { assessmentNavGroups } from "@/lib/assessments/nav";
import { PHASES, phaseOf } from "@/lib/assessments/workflow";
import { guardPage, requireRole } from "@/lib/auth/guard";
import { ALL_ROLES } from "@/lib/auth/roles";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

// docs/05 bagian 2: setiap halaman konsol menampilkan nama organisasi, nama asesmen, status, dan tahap di bagian atas.
// Navigasi dikelompokkan per tahap alur kerja agar pengguna tahu halaman mana yang relevan saat ini.
export default async function AssessmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = paramsSchema.parse(await params);
  const access = await guardPage(() => requireRole(id, ALL_ROLES));
  const assessment = await loadAssessmentHeader(access.assessmentId, access.organizationId);
  const t = await getTranslations();

  const groups: AssessmentNavGroup[] = assessmentNavGroups(assessment.id, assessment.status, access.roles).map((group) => ({
    key: group.key,
    title: group.key === "overview" ? undefined : group.key === "OTHER" ? t("assessment.phases.OTHER") : `${PHASES.indexOf(group.key) + 1}. ${t(`assessment.phases.${group.key}`)}`,
    state: group.state,
    stateLabel: group.state ? t(`assessment.phaseStates.${group.state}`) : undefined,
    items: group.items.map((item) => ({ ...item, label: t(`assessment.nav.${item.page}`) })),
  }));
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
      <div className="space-y-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 lg:space-y-0">
        <AssessmentNav groups={groups} label={t("assessment.nav.label")} menuLabel={t("assessment.nav.menu")} />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
