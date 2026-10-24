// Parameter asesmen yang dapat diubah sebelum dikunci, dan pemetaannya dari parameter bawaan instrumen
// (seed/aspek-dan-parameter.json yang tersimpan di InstrumentVersion.defaultParameters).

import { z } from "zod";
import type { SamplePlan } from "@/lib/scoring/sampling";

const unitInterval = z.number().min(0).max(1);
const levelDistance = z.number().min(0).max(4);

/** Bagian parameter yang boleh disesuaikan lead assessor (docs/01 M1). Bobot aspek tidak termasuk. */
export const editableParametersSchema = z.object({
  layerWeights: z
    .object({ perception: unitInterval, evidence: unitInterval, validation: unitInterval })
    .refine((w) => Math.abs(w.perception + w.evidence + w.validation - 1) < 1e-6, { message: "LAYER_WEIGHTS_SUM" }),
  selfAssessmentWeightInPerception: unitInterval,
  divergenceThreshold: levelDistance,
  consolidation: z.object({ maxAspectBelowLevel: levelDistance, maxCharacteristicBelowLevel: levelDistance }),
  perceptionGapAttention: levelDistance,
  assessorDisagreementFlag: levelDistance,
  sclThresholds: z
    .array(z.object({ step: z.number().int().min(2).max(5), minWeightedAverage: unitInterval, minPerAspect: unitInterval }))
    .length(4)
    .refine((rows) => rows.map((r) => r.step).join(",") === "2,3,4,5", { message: "SCL_STEPS" }),
  quality: z.object({
    cronbachAlphaMin: unitInterval,
    rwgMin: unitInterval,
    // Komitmen proposal: minimal 5 responden per sel laporan; tidak boleh diturunkan (CLAUDE.md aturan 3).
    minRespondentsPerReportCell: z.number().int().min(5).max(50),
  }),
  sampling: z.object({
    z: z.number().min(1).max(4),
    marginOfError: z.number().gt(0).max(0.5),
    proportion: z.number().gt(0).lt(1),
    minParticipationPerStratum: unitInterval,
  }),
});

export type EditableParameters = z.infer<typeof editableParametersSchema>;

export interface StoredSamplePlan {
  projects: number;
  locations: number;
  computedAt: string;
  result: SamplePlan;
}

/**
 * Draf parameter: salinan parameter bawaan instrumen (tanpa kunci catatan) ditambah hasil kalkulator sampel.
 * Kunci lain (aspek, skala, faktor sampel, retensi) dipertahankan apa adanya.
 */
export type DraftParameters = EditableParameters & {
  aspects: { code: string; name: string; maxPoints: Record<string, number> | null; excludedFromLevel?: boolean }[];
  sampling: EditableParameters["sampling"] & {
    sclInterviewFactorManagement: number;
    sclInterviewFactorOperational: number;
    sclProjectFactor: number;
    fgdMaxParticipantsPerSession: number;
  };
  quality: EditableParameters["quality"] & Record<string, number>;
  defaultStrata: { code: string; name: string; group: "MANAGEMENT" | "SUPERVISORY" | "FIELD"; isContractor: boolean }[];
  retention: { rawDataMonths: number };
  samplePlan?: StoredSamplePlan | null;
  [key: string]: unknown;
};

export function draftFromDefaults(defaults: unknown): DraftParameters {
  const source = (defaults ?? {}) as Record<string, unknown>;
  const clean = Object.fromEntries(Object.entries(source).filter(([key]) => !key.startsWith("_")));
  return { ...clean, samplePlan: null } as DraftParameters;
}

/** Hanya bagian yang dapat diubah, untuk formulir. */
export function editablePart(draft: DraftParameters): EditableParameters {
  return {
    layerWeights: { ...draft.layerWeights },
    selfAssessmentWeightInPerception: draft.selfAssessmentWeightInPerception,
    divergenceThreshold: draft.divergenceThreshold,
    consolidation: { ...draft.consolidation },
    perceptionGapAttention: draft.perceptionGapAttention,
    assessorDisagreementFlag: draft.assessorDisagreementFlag,
    sclThresholds: draft.sclThresholds.map((t) => ({ step: t.step, minWeightedAverage: t.minWeightedAverage, minPerAspect: t.minPerAspect })),
    quality: {
      cronbachAlphaMin: draft.quality.cronbachAlphaMin,
      rwgMin: draft.quality.rwgMin,
      minRespondentsPerReportCell: draft.quality.minRespondentsPerReportCell,
    },
    sampling: {
      z: draft.sampling.z,
      marginOfError: draft.sampling.marginOfError,
      proportion: draft.sampling.proportion,
      minParticipationPerStratum: draft.sampling.minParticipationPerStratum,
    },
  };
}

/** Menggabungkan perubahan ke draf. Hasil kalkulator sampel dibatalkan bila parameter sampel berubah. */
export function applyEdits(draft: DraftParameters, edits: EditableParameters): DraftParameters {
  const samplingChanged = (Object.keys(edits.sampling) as (keyof EditableParameters["sampling"])[]).some(
    (k) => edits.sampling[k] !== draft.sampling[k],
  );
  return {
    ...draft,
    layerWeights: edits.layerWeights,
    selfAssessmentWeightInPerception: edits.selfAssessmentWeightInPerception,
    divergenceThreshold: edits.divergenceThreshold,
    consolidation: edits.consolidation,
    perceptionGapAttention: edits.perceptionGapAttention,
    assessorDisagreementFlag: edits.assessorDisagreementFlag,
    sclThresholds: draft.sclThresholds.map((row) => {
      const edited = edits.sclThresholds.find((e) => e.step === row.step);
      return edited ? { ...row, minWeightedAverage: edited.minWeightedAverage, minPerAspect: edited.minPerAspect } : row;
    }),
    quality: { ...draft.quality, ...edits.quality },
    sampling: { ...draft.sampling, ...edits.sampling },
    samplePlan: samplingChanged ? null : (draft.samplePlan ?? null),
  };
}

/** Angka desimal dari isian formulir; menerima koma atau titik desimal ("0,35" dan "0.35"). */
export function parseDecimal(input: FormDataEntryValue | null | undefined): number | null {
  if (typeof input !== "string") return null;
  const text = input.trim().replace(/\s+/g, "");
  if (!/^-?\d+([.,]\d+)?$/.test(text)) return null;
  return Number(text.replace(",", "."));
}

/** Bobot aspek turunan dari poin tingkat 5 (tidak dapat diubah; mengikuti struktur Safety Culture Ladder). */
export function aspectWeights(draft: Pick<DraftParameters, "aspects">): { code: string; name: string; weight: number }[] {
  const levelAspects = draft.aspects.filter((a) => !a.excludedFromLevel && a.maxPoints);
  const total = levelAspects.reduce((s, a) => s + (a.maxPoints?.["5"] ?? 0), 0);
  return levelAspects.map((a) => ({ code: a.code, name: a.name, weight: (a.maxPoints?.["5"] ?? 0) / total }));
}
