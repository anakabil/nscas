// Bentuk snapshot isi laporan (docs/01 bagian 6). Disimpan di Report.content saat versi dibuat dan dipakai
// penyaji HTML tanpa membaca basis data lagi, sehingga laporan final tidak berubah walaupun data berubah.
// Semua nilai yang berasal dari jawaban survei sudah melewati penyembunyian sel di bawah 5 responden.

import type { Flag, SclStep } from "@/lib/scoring";
import type { Heatmap } from "@/lib/dashboard/analytics";

export type ReportKind = "FULL" | "EXECUTIVE_SUMMARY" | "STATEMENT";

export interface ReportCharacteristic {
  code: string;
  name: string;
  aspectCode: string;
  isContextual: boolean;
  /** Null bila kosong atau disembunyikan (jawaban survei kurang dari 5). */
  perception: number | null;
  perceptionHidden: boolean;
  evidence: number | null;
  validation: number | null;
  combined: number | null;
  final: number | null;
  panelAdjusted: number | null;
  divergence: number | null;
  flags: Flag[];
}

export interface ReportLimitation {
  code: string;
  items?: string[];
}

export interface ReportContent {
  schemaVersion: 1;
  version: number;
  generatedAt: string;
  organization: { name: string; legalName: string; sector: string | null };
  assessment: {
    name: string;
    scopeType: string;
    periodStart: string;
    periodEnd: string;
    targetLevel: number;
    instrumentVersion: string;
    surveyOpensAt: string | null;
    surveyClosesAt: string | null;
    lockedAt: string | null;
  };
  units: { name: string; type: string; parentName: string | null }[];
  method: {
    layerWeights: { perception: number; evidence: number; validation: number };
    selfAssessmentWeight: number;
    divergenceThreshold: number;
    assessorDisagreementFlag: number;
    consolidation: { maxAspectBelowLevel: number; maxCharacteristicBelowLevel: number };
    perceptionGapAttention: number;
    minCell: number;
    aspects: { code: string; name: string; weight: number }[];
    sclThresholds: { step: number; minWeightedAverage: number; minPerAspect: number }[];
    samplePlan: {
      workers: number;
      projects: number;
      locations: number;
      surveyRecommended: number;
      surveyTargetTotal: number;
      interviewsManagement: number;
      interviewsOperational: number;
      projectsToVisit: number;
      strata: { code: string; name: string; population: number; target: number }[];
    } | null;
    counts: { responses: number; selfAssessments: number; evidenceRatings: number; validationRatings: number };
  };
  participation: {
    minParticipation: number;
    strata: { code: string; name: string; population: number; completed: number | null; rate: number | null; belowMinimum: boolean }[];
    units: { name: string; completed: number | null; rate: number | null }[];
    totals: { population: number; completed: number | null; rate: number | null };
  };
  reliability: {
    alphaMin: number;
    rwgMin: number;
    alpha: { code: string; name: string; value: number | null; n: number | null; below: boolean }[];
    rwg: { name: string; value: number | null; n: number | null; below: boolean }[];
  };
  result: {
    finalizedAt: string | null;
    finalizedBy: string | null;
    organization: { index: number; engineIndex: number; indicativeLevel: number; consolidated: boolean; gapToTarget: number; priorityAspect: string; contextualIndex: number | null; minAspectIndex: number; minCharacteristicIndex: number };
    aspects: { code: string; name: string; weight: number; index: number; engineIndex: number; gapToTarget: number }[];
    characteristics: ReportCharacteristic[];
    sclTrack: { indicativeLevel: number; steps: { step: SclStep; weightedAverage: number; minimum: number; passed: boolean }[] } | null;
  };
  perceptionGap: { code: string; name: string; management: number | null; field: number | null; gap: number | null; attention: boolean; suppressed: boolean }[];
  strataHeatmap: Heatmap | null;
  panel: { code: string; name: string; engineValue: number; adjustedValue: number; rationale: string; decidedBy: string; decidedAt: string }[];
  gaps: {
    rank: number;
    code: string;
    name: string;
    aspectCode: string;
    currentIndex: number;
    gap: number;
    priorityScore: number;
    isContextual: boolean;
    priority: string | null;
    rootCause: string | null;
    actions: { title: string; owner: string; position: string; unit: string | null; dueDate: string; indicator: string; status: string }[];
  }[];
  limitations: ReportLimitation[];
  appendices: {
    participants: { session: string; type: string; scheduledAt: string | null; people: { fullName: string; position: string }[] }[];
    evidence: { title: string; unit: string | null; version: number; mimeType: string; codes: string[]; sha256: string; uploadedAt: string }[];
    parameters: Record<string, unknown>;
  };
}
