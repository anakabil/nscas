// Mesin status asesmen (docs/01 bagian 3). Murni: syarat dievaluasi dari fakta yang dikumpulkan
// pemanggil, sehingga setiap transisi dapat diuji tanpa basis data.

import type { AssessmentStatus, Role } from "@/generated/prisma/enums";

export const STATUS_ORDER: readonly AssessmentStatus[] = [
  "DRAFT",
  "CONFIGURED",
  "LOCKED",
  "DATA_COLLECTION",
  "SCORING",
  "PANEL_REVIEW",
  "ACTION_PLANNING",
  "REPORTED",
  "MONITORING",
  "ARCHIVED",
  "PURGED",
];

export type ConditionCode =
  | "HAS_UNITS"
  | "HAS_STRATA"
  | "STRATA_POPULATED"
  | "INSTRUMENT_PUBLISHED"
  | "LEAD_ASSESSOR_ASSIGNED"
  | "CONSENT_TEXT_FILLED"
  | "DPA_SIGNED"
  | "SAMPLE_PLAN_SAVED"
  | "ROSTER_IMPORTED"
  | "TOKENS_ISSUED"
  | "SURVEY_CLOSED"
  | "TWO_ASSESSOR_RATINGS"
  | "SCORE_RUN_SAVED"
  | "ADJUSTMENTS_JUSTIFIED"
  | "RESULT_FINAL"
  | "FINAL_REPORT_SIGNED"
  | "ACTION_PLAN_PUBLISHED"
  | "RETENTION_EXPIRED"
  | "DESTRUCTION_RECORDED";

/** Fakta tentang satu asesmen yang diperlukan untuk menilai syarat transisi. */
export interface TransitionFacts {
  unitCount: number;
  strataCount: number;
  strataWithoutPopulation: number;
  instrumentPublished: boolean;
  leadAssessorCount: number;
  consentTextFilled: boolean;
  dpaSigned: boolean;
  samplePlanSaved: boolean;
  rosterCount: number;
  surveyTokenCount: number;
  surveyClosed: boolean;
  characteristicCount: number;
  characteristicsWithTwoAssessors: number;
  scoreRunCount: number;
  finalScoreRun: boolean;
  unjustifiedAdjustmentCount: number;
  finalReportSigned: boolean;
  actionPlanPublished: boolean;
  retentionExpired: boolean;
  destructionRecorded: boolean;
}

export interface TransitionDefinition {
  from: AssessmentStatus;
  to: AssessmentStatus;
  actorRoles: readonly Role[];
  conditions: readonly ConditionCode[];
}

const CONFIGURATION: ConditionCode[] = [
  "HAS_UNITS",
  "HAS_STRATA",
  "STRATA_POPULATED",
  "INSTRUMENT_PUBLISHED",
  "LEAD_ASSESSOR_ASSIGNED",
];

/**
 * Tabel transisi docs/01 bagian 3. Syarat konfigurasi diperiksa ulang saat penguncian karena unit
 * dan strata masih dapat diubah selama berstatus CONFIGURED. MONITORING ke ARCHIVED tidak memiliki
 * syarat di dokumen; transisi ini dilakukan lead assessor.
 */
export const TRANSITIONS: readonly TransitionDefinition[] = [
  { from: "DRAFT", to: "CONFIGURED", actorRoles: ["LEAD_ASSESSOR"], conditions: CONFIGURATION },
  {
    from: "CONFIGURED",
    to: "LOCKED",
    actorRoles: ["LEAD_ASSESSOR"],
    conditions: [...CONFIGURATION, "CONSENT_TEXT_FILLED", "DPA_SIGNED", "SAMPLE_PLAN_SAVED"],
  },
  { from: "LOCKED", to: "DATA_COLLECTION", actorRoles: ["LEAD_ASSESSOR"], conditions: ["ROSTER_IMPORTED", "TOKENS_ISSUED"] },
  { from: "DATA_COLLECTION", to: "SCORING", actorRoles: ["LEAD_ASSESSOR"], conditions: ["SURVEY_CLOSED", "TWO_ASSESSOR_RATINGS"] },
  { from: "SCORING", to: "PANEL_REVIEW", actorRoles: ["LEAD_ASSESSOR"], conditions: ["SCORE_RUN_SAVED"] },
  { from: "PANEL_REVIEW", to: "ACTION_PLANNING", actorRoles: ["LEAD_ASSESSOR"], conditions: ["ADJUSTMENTS_JUSTIFIED", "RESULT_FINAL"] },
  { from: "ACTION_PLANNING", to: "REPORTED", actorRoles: ["LEAD_ASSESSOR"], conditions: ["FINAL_REPORT_SIGNED"] },
  { from: "REPORTED", to: "MONITORING", actorRoles: ["LEAD_ASSESSOR"], conditions: ["ACTION_PLAN_PUBLISHED"] },
  { from: "MONITORING", to: "ARCHIVED", actorRoles: ["LEAD_ASSESSOR"], conditions: [] },
  { from: "ARCHIVED", to: "PURGED", actorRoles: ["SUPER_ADMIN"], conditions: ["RETENTION_EXPIRED", "DESTRUCTION_RECORDED"] },
];

export function evaluateCondition(code: ConditionCode, f: TransitionFacts): boolean {
  switch (code) {
    case "HAS_UNITS":
      return f.unitCount > 0;
    case "HAS_STRATA":
      return f.strataCount > 0;
    case "STRATA_POPULATED":
      return f.strataCount > 0 && f.strataWithoutPopulation === 0;
    case "INSTRUMENT_PUBLISHED":
      return f.instrumentPublished;
    case "LEAD_ASSESSOR_ASSIGNED":
      return f.leadAssessorCount > 0;
    case "CONSENT_TEXT_FILLED":
      return f.consentTextFilled;
    case "DPA_SIGNED":
      return f.dpaSigned;
    case "SAMPLE_PLAN_SAVED":
      return f.samplePlanSaved;
    case "ROSTER_IMPORTED":
      return f.rosterCount > 0;
    case "TOKENS_ISSUED":
      return f.surveyTokenCount > 0;
    case "SURVEY_CLOSED":
      return f.surveyClosed;
    case "TWO_ASSESSOR_RATINGS":
      return f.characteristicCount > 0 && f.characteristicsWithTwoAssessors === f.characteristicCount;
    case "SCORE_RUN_SAVED":
      return f.scoreRunCount > 0;
    case "ADJUSTMENTS_JUSTIFIED":
      return f.unjustifiedAdjustmentCount === 0;
    case "RESULT_FINAL":
      return f.finalScoreRun;
    case "FINAL_REPORT_SIGNED":
      return f.finalReportSigned;
    case "ACTION_PLAN_PUBLISHED":
      return f.actionPlanPublished;
    case "RETENTION_EXPIRED":
      return f.retentionExpired;
    case "DESTRUCTION_RECORDED":
      return f.destructionRecorded;
  }
}

export interface TransitionEvaluation {
  definition: TransitionDefinition;
  conditions: { code: ConditionCode; met: boolean }[];
  allowed: boolean;
}

export function evaluateTransition(definition: TransitionDefinition, facts: TransitionFacts): TransitionEvaluation {
  const conditions = definition.conditions.map((code) => ({ code, met: evaluateCondition(code, facts) }));
  return { definition, conditions, allowed: conditions.every((c) => c.met) };
}

export function findTransition(from: AssessmentStatus, to: AssessmentStatus): TransitionDefinition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function nextTransitions(status: AssessmentStatus): TransitionDefinition[] {
  return TRANSITIONS.filter((t) => t.from === status);
}

/** Bobot, ambang, versi instrumen, dan strata hanya dapat diubah sebelum dikunci (CLAUDE.md aturan 5). */
export function isConfigurationEditable(status: AssessmentStatus): boolean {
  return status === "DRAFT" || status === "CONFIGURED";
}

/** Unit tetap dapat dilengkapi (misalnya koordinat proyek) sampai asesmen diarsipkan. */
export function areUnitsEditable(status: AssessmentStatus): boolean {
  return STATUS_ORDER.indexOf(status) < STATUS_ORDER.indexOf("ARCHIVED");
}
