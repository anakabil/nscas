// Simbol menu NSCAS (docs/05 bagian 2, docs/11 bagian 6): set khusus NSCAS di public/icons/nav, diubah menjadi
// komponen oleh `npm run icons`. Dipakai kolom samping asesmen, akses cepat di Ringkasan, dan kepala halaman konsol.

import type { Icon } from "@/components/icons/create-icon";
import {
  NavAccount,
  NavActionPlan,
  NavAssessments,
  NavAudit,
  NavDashboard,
  NavDetails,
  NavEvidence,
  NavObservations,
  NavOrganizations,
  NavOverview,
  NavPanel,
  NavParameters,
  NavParticipation,
  NavPhaseDataCollection,
  NavPhasePreparation,
  NavPhaseResults,
  NavPhaseScoring,
  NavQr,
  NavReport,
  NavRespondents,
  NavRetention,
  NavSampling,
  NavScoring,
  NavSelfAssessments,
  NavStrata,
  NavTeam,
  NavUnits,
  NavValidation,
} from "@/components/icons/nscas-icons";
import type { NavGroupKey, NavPage } from "@/lib/assessments/nav";

export const PAGE_ICONS: Record<NavPage, Icon> = {
  overview: NavOverview,
  details: NavDetails,
  units: NavUnits,
  strata: NavStrata,
  parameters: NavParameters,
  sampling: NavSampling,
  team: NavTeam,
  respondents: NavRespondents,
  qr: NavQr,
  participation: NavParticipation,
  selfAssessments: NavSelfAssessments,
  evidence: NavEvidence,
  observations: NavObservations,
  validation: NavValidation,
  scoring: NavScoring,
  panel: NavPanel,
  dashboard: NavDashboard,
  gaps: NavActionPlan,
  report: NavReport,
  audit: NavAudit,
};

export const GROUP_ICONS: Record<Exclude<NavGroupKey, "overview">, Icon> = {
  PREPARATION: NavPhasePreparation,
  DATA_COLLECTION: NavPhaseDataCollection,
  SCORING: NavPhaseScoring,
  RESULTS: NavPhaseResults,
  OTHER: NavAudit,
};

/** Menu utama di kepala halaman konsol. */
export type ConsoleSection = "assessments" | "organizations" | "retention" | "account";

export const CONSOLE_ICONS: Record<ConsoleSection, Icon> = {
  assessments: NavAssessments,
  organizations: NavOrganizations,
  retention: NavRetention,
  account: NavAccount,
};
