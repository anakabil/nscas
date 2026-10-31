// Alur kerja asesmen untuk navigasi dan panduan langkah (docs/01 bagian 3, docs/05 bagian 2). Murni: tidak
// menyentuh basis data. Sebelas status mesin status dikelompokkan menjadi empat tahap yang mudah dipahami
// pengguna, dan setiap syarat transisi dipetakan ke halaman tempat syarat itu dipenuhi.

import type { AssessmentStatus } from "@/generated/prisma/enums";
import type { ConditionCode } from "./state-machine";

export type WorkflowPhase = "PREPARATION" | "DATA_COLLECTION" | "SCORING" | "RESULTS";

export const PHASES: readonly WorkflowPhase[] = ["PREPARATION", "DATA_COLLECTION", "SCORING", "RESULTS"];

/** Tahap setiap status; ARCHIVED dan PURGED berarti seluruh tahap sudah selesai. */
const PHASE_OF: Record<AssessmentStatus, WorkflowPhase | "CLOSED"> = {
  DRAFT: "PREPARATION",
  CONFIGURED: "PREPARATION",
  LOCKED: "DATA_COLLECTION",
  DATA_COLLECTION: "DATA_COLLECTION",
  SCORING: "SCORING",
  PANEL_REVIEW: "SCORING",
  ACTION_PLANNING: "RESULTS",
  REPORTED: "RESULTS",
  MONITORING: "RESULTS",
  ARCHIVED: "CLOSED",
  PURGED: "CLOSED",
};

export function phaseOf(status: AssessmentStatus): WorkflowPhase | "CLOSED" {
  return PHASE_OF[status];
}

export type PhaseState = "done" | "current" | "upcoming";

export function phaseState(phase: WorkflowPhase, status: AssessmentStatus): PhaseState {
  const current = PHASE_OF[status];
  if (current === "CLOSED") return "done";
  const diff = PHASES.indexOf(phase) - PHASES.indexOf(current);
  return diff < 0 ? "done" : diff === 0 ? "current" : "upcoming";
}

/** Halaman asesmen, sama dengan kunci assessment.nav di messages. */
export type AssessmentPage =
  | "details"
  | "units"
  | "strata"
  | "parameters"
  | "sampling"
  | "team"
  | "respondents"
  | "scoring"
  | "panel"
  | "gaps"
  | "report";

const PAGE_PATH: Record<AssessmentPage, string> = {
  details: "setup",
  units: "setup/units",
  strata: "setup/strata",
  parameters: "setup/parameters",
  sampling: "setup/sampling",
  team: "setup/team",
  respondents: "respondents",
  scoring: "scoring",
  panel: "panel",
  gaps: "gaps",
  report: "report",
};

/** Tempat setiap syarat transisi dipenuhi. "retention" berarti menu Retensi data di luar asesmen. */
export const CONDITION_PAGE: Record<ConditionCode, AssessmentPage | "retention"> = {
  HAS_UNITS: "units",
  HAS_STRATA: "strata",
  STRATA_POPULATED: "strata",
  INSTRUMENT_PUBLISHED: "details",
  LEAD_ASSESSOR_ASSIGNED: "team",
  CONSENT_TEXT_FILLED: "parameters",
  DPA_SIGNED: "parameters",
  SAMPLE_PLAN_SAVED: "sampling",
  ROSTER_IMPORTED: "respondents",
  TOKENS_ISSUED: "respondents",
  SURVEY_CLOSED: "respondents",
  TWO_ASSESSOR_RATINGS: "scoring",
  SCORE_RUN_SAVED: "scoring",
  ADJUSTMENTS_JUSTIFIED: "panel",
  RESULT_FINAL: "panel",
  FINAL_REPORT_SIGNED: "report",
  ACTION_PLAN_PUBLISHED: "gaps",
  RETENTION_EXPIRED: "retention",
  DESTRUCTION_RECORDED: "retention",
};

export function conditionHref(assessmentId: string, code: ConditionCode): string {
  const page = CONDITION_PAGE[code];
  return page === "retention" ? "/retention" : `/assessments/${assessmentId}/${PAGE_PATH[page]}`;
}
