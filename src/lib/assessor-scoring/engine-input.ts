// Penyusunan masukan mesin penilaian dari baris basis data (docs/03 bagian 2 sampai 5). Murni: pemanggil
// menyaring data per asesmen dan membaca strata serta parameter dari Assessment.parameterSnapshot.
// Snapshot masukan yang disimpan di ScoreRun hanya memuat nilai lapisan dan hitungan, bukan jawaban mentah,
// agar ScoreRun final yang disimpan melewati masa retensi tidak memuat data responden.

import {
  buildCharacteristicInputs,
  perception,
  type EngineInput,
  type EngineParameters,
  type RawAssessmentInput,
  type SclFulfillment,
  type SclStep,
  type StratumGroup,
} from "@/lib/scoring";

export interface ScoringRows {
  characteristics: { id: string; code: string; aspectCode: string; isContextual: boolean }[];
  strata: { id: string; code: string; group: StratumGroup; population: number }[];
  /** Respons survei yang tidak dikeluarkan; jawaban null berarti "Tidak tahu". */
  responses: { stratumId: string; answers: { characteristicId: string; level: number | null }[] }[];
  /** Penilaian mandiri berstatus SUBMITTED. */
  selfAssessments: { answers: { characteristicId: string; level: number | null }[] }[];
  evidenceRatings: { characteristicId: string; assessorId: string; level: number }[];
  /** Nilai dari sesi validasi yang tidak dibatalkan. */
  validationRatings: { sessionId: string; characteristicId: string; assessorId: string; level: number }[];
  scl: { aspectCode: string; step: number; percent: number }[];
  targetLevel: number;
}

export interface CharacteristicSources {
  surveyAnswers: number;
  dontKnow: number;
  survey: number | null;
  selfAssessments: number;
  selfAssessment: number | null;
  evidenceAssessors: number;
  evidenceMin: number | null;
  evidenceMax: number | null;
  validationSessions: number;
}

export interface ScoringInputSnapshot {
  engineInput: EngineInput;
  sources: Record<string, CharacteristicSources>;
  counts: { responses: number; selfAssessments: number; evidenceRatings: number; validationRatings: number };
  strata: { code: string; group: StratumGroup; population: number; responses: number }[];
  /** Jalur setara disertakan hanya bila seluruh aspek dan tingkat 2 sampai 5 terisi. */
  sclComplete: boolean;
}

const SCL_STEPS: readonly SclStep[] = [2, 3, 4, 5];

/** Aspek yang masuk jalur setara: aspek dengan bobot (bukan kontekstual). */
export function sclAspectCodes(params: EngineParameters): string[] {
  return params.aspects.filter((a) => !a.excludedFromLevel && a.maxPointsStep5 !== null).map((a) => a.code);
}

export function sclFulfillmentFrom(rows: ScoringRows["scl"], aspectCodes: readonly string[]): SclFulfillment | null {
  const out: SclFulfillment = {};
  for (const code of aspectCodes) {
    const steps = {} as Record<SclStep, number>;
    for (const step of SCL_STEPS) {
      const row = rows.find((r) => r.aspectCode === code && r.step === step);
      if (!row) return null;
      steps[step] = row.percent / 100;
    }
    out[code] = steps;
  }
  return out;
}

export function toRawInput(rows: ScoringRows, params: EngineParameters): RawAssessmentInput {
  const charCode = new Map(rows.characteristics.map((c) => [c.id, c.code]));
  const stratumCode = new Map(rows.strata.map((s) => [s.id, s.code]));
  const answers = (list: { characteristicId: string; level: number | null }[]) =>
    Object.fromEntries(list.filter((a) => charCode.has(a.characteristicId)).map((a) => [charCode.get(a.characteristicId) as string, a.level]));
  const known = <T extends { characteristicId: string }>(list: T[]) => list.filter((r) => charCode.has(r.characteristicId));
  return {
    characteristics: rows.characteristics.map(({ code, aspectCode, isContextual }) => ({ code, aspectCode, isContextual })),
    strata: rows.strata.map(({ code, group, population }) => ({ code, group, population })),
    surveyResponses: rows.responses.map((r) => {
      const code = stratumCode.get(r.stratumId);
      if (!code) throw new Error(`Survey response stratum ${r.stratumId} is not in the parameter snapshot`);
      return { stratumCode: code, characteristicAnswers: answers(r.answers) };
    }),
    selfAssessments: rows.selfAssessments.map((s) => ({ status: "SUBMITTED" as const, answers: answers(s.answers) })),
    evidenceRatings: known(rows.evidenceRatings).map((r) => ({ characteristicCode: charCode.get(r.characteristicId) as string, assessorId: r.assessorId, level: r.level })),
    validationRatings: known(rows.validationRatings).map((r) => ({
      sessionId: r.sessionId,
      characteristicCode: charCode.get(r.characteristicId) as string,
      assessorId: r.assessorId,
      level: r.level,
    })),
    targetLevel: rows.targetLevel,
    sclFulfillment: sclFulfillmentFrom(rows.scl, sclAspectCodes(params)) ?? undefined,
  };
}

/** Masukan mesin (nilai tiga lapisan per karakteristik) beserta ringkasan sumbernya untuk matriks triangulasi. */
export function buildScoringInput(rows: ScoringRows, params: EngineParameters): ScoringInputSnapshot {
  const raw = toRawInput(rows, params);
  const population = Object.fromEntries(raw.strata.map((s) => [s.code, s.population]));
  const sources: Record<string, CharacteristicSources> = {};
  for (const def of raw.characteristics) {
    const byStratum: Record<string, (number | null)[]> = {};
    for (const r of raw.surveyResponses) {
      if (def.code in r.characteristicAnswers) (byStratum[r.stratumCode] ??= []).push(r.characteristicAnswers[def.code] ?? null);
    }
    const all = Object.values(byStratum).flat();
    const sa = raw.selfAssessments.map((s) => s.answers[def.code] ?? null);
    const p = perception(byStratum, population, sa, params.selfAssessmentWeightInPerception);
    const evidence = raw.evidenceRatings.filter((r) => r.characteristicCode === def.code).map((r) => r.level);
    sources[def.code] = {
      surveyAnswers: all.filter((a) => a !== null).length,
      dontKnow: all.filter((a) => a === null).length,
      survey: p.survey,
      selfAssessments: sa.filter((a) => a !== null).length,
      selfAssessment: p.selfAssessment,
      evidenceAssessors: new Set(raw.evidenceRatings.filter((r) => r.characteristicCode === def.code).map((r) => r.assessorId)).size,
      evidenceMin: evidence.length ? Math.min(...evidence) : null,
      evidenceMax: evidence.length ? Math.max(...evidence) : null,
      validationSessions: new Set(raw.validationRatings.filter((r) => r.characteristicCode === def.code).map((r) => r.sessionId)).size,
    };
  }
  const responsesByStratum = new Map<string, number>();
  for (const r of raw.surveyResponses) responsesByStratum.set(r.stratumCode, (responsesByStratum.get(r.stratumCode) ?? 0) + 1);
  return {
    engineInput: {
      characteristics: buildCharacteristicInputs(raw, params),
      targetLevel: raw.targetLevel,
      ...(raw.sclFulfillment ? { sclFulfillment: raw.sclFulfillment } : {}),
    },
    sources,
    counts: {
      responses: raw.surveyResponses.length,
      selfAssessments: raw.selfAssessments.length,
      evidenceRatings: raw.evidenceRatings.length,
      validationRatings: raw.validationRatings.length,
    },
    strata: raw.strata.map((s) => ({ ...s, responses: responsesByStratum.get(s.code) ?? 0 })),
    sclComplete: Boolean(raw.sclFulfillment),
  };
}

/** Masukan mesin dengan penyesuaian panel (kode karakteristik ke nilai panel). */
export function withPanelAdjustments(input: EngineInput, adjustments: Record<string, number>): EngineInput {
  return { ...input, characteristics: input.characteristics.map((c) => ({ ...c, panelAdjusted: adjustments[c.code] ?? null })) };
}
