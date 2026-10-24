// Pemetaan Assessment.parameterSnapshot (berbentuk seed/aspek-dan-parameter.json) ke parameter mesin.
// Mesin selalu membaca parameter dari snapshot asesmen yang terkunci, bukan dari berkas seed.

import { EngineInputError, type EngineParameters, type SclStep } from "./types";

export interface ParameterSnapshot {
  aspects: {
    code: string;
    maxPoints: Record<string, number> | null;
    excludedFromLevel?: boolean;
  }[];
  layerWeights: EngineParameters["layerWeights"];
  selfAssessmentWeightInPerception: number;
  divergenceThreshold: number;
  consolidation: EngineParameters["consolidation"];
  perceptionGapAttention: number;
  assessorDisagreementFlag: number;
  sclThresholds: { step: number; minWeightedAverage: number; minPerAspect: number }[];
  quality: { minRespondentsPerReportCell: number };
}

export function toEngineParameters(snapshot: ParameterSnapshot): EngineParameters {
  return {
    layerWeights: { ...snapshot.layerWeights },
    selfAssessmentWeightInPerception: snapshot.selfAssessmentWeightInPerception,
    divergenceThreshold: snapshot.divergenceThreshold,
    consolidation: { ...snapshot.consolidation },
    perceptionGapAttention: snapshot.perceptionGapAttention,
    assessorDisagreementFlag: snapshot.assessorDisagreementFlag,
    aspects: snapshot.aspects.map((a) => ({
      code: a.code,
      maxPointsStep5: a.maxPoints?.["5"] ?? null,
      excludedFromLevel: a.excludedFromLevel ?? false,
    })),
    sclThresholds: snapshot.sclThresholds.map((t) => {
      if (![2, 3, 4, 5].includes(t.step)) {
        throw new EngineInputError(`Tingkat ambang jalur setara ${t.step} tidak dikenal`);
      }
      return { step: t.step as SclStep, minWeightedAverage: t.minWeightedAverage, minPerAspect: t.minPerAspect };
    }),
    minRespondentsPerReportCell: snapshot.quality.minRespondentsPerReportCell,
  };
}
