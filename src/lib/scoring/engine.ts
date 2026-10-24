// Mesin penilaian NSCAS sesuai docs/03 bagian 2 sampai 6.
// Implementasi rujukan: seed/fixtures/referensi_skoring.py. Modul ini murni:
// tanpa impor Prisma, Next.js, atau I/O, dan tanpa pembulatan (pembulatan hanya saat ditampilkan).

import { EPS, mean } from "./numeric";
import {
  EngineInputError,
  type AspectResult,
  type CharacteristicInput,
  type CharacteristicResult,
  type CharacteristicScore,
  type EngineInput,
  type EngineParameters,
  type EngineResult,
  type Flag,
  type LayerCombination,
  type LayerWeights,
  type Level,
  type OrganizationResult,
  type PerceptionGapResult,
  type PerceptionResult,
  type RawAssessmentInput,
  type SclFulfillment,
  type SclStep,
  type SclStepResult,
  type SclTrackResult,
  type StratumGroup,
  type StratumInput,
  type SurveyResponseInput,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

const SCL_STEPS: readonly SclStep[] = [2, 3, 4, 5];

function assertLevel(value: number, context: string): void {
  if (!Number.isFinite(value) || value < 1 - EPS || value > 5 + EPS) {
    throw new EngineInputError(`${context}: nilai ${value} di luar rentang 1 sampai 5`);
  }
}

// ---------------------------------------------------------------------------
// 2.1 Persepsi
// ---------------------------------------------------------------------------

/**
 * Skor survei berbobot populasi strata: jumlah(w_s x m_s) / jumlah(w_s), hanya untuk strata
 * yang memiliki minimal satu jawaban selain "Tidak tahu" (null). Null bila tidak ada jawaban.
 */
export function surveyScore(
  answersByStratum: Record<string, readonly (number | null)[]>,
  populationByStratum: Record<string, number>,
): number | null {
  let num = 0;
  let den = 0;
  for (const [code, answers] of Object.entries(answersByStratum)) {
    const valid = answers.filter((a): a is number => a !== null);
    if (valid.length === 0) continue;
    const w = populationByStratum[code];
    if (w === undefined || !Number.isFinite(w) || w <= 0) {
      throw new EngineInputError(`Populasi strata ${code} tidak tersedia atau tidak valid`);
    }
    num += w * mean(valid);
    den += w;
  }
  return den > 0 ? num / den : null;
}

/** P_c = (1 - alfa) x S_c + alfa x A_c; bila tidak ada penilaian mandiri, P_c = S_c. */
export function perception(
  answersByStratum: Record<string, readonly (number | null)[]>,
  populationByStratum: Record<string, number>,
  selfAssessmentLevels: readonly (number | null)[],
  alpha: number,
): PerceptionResult {
  const survey = surveyScore(answersByStratum, populationByStratum);
  const sa = selfAssessmentLevels.filter((x): x is number => x !== null);
  const selfAssessment = sa.length > 0 ? mean(sa) : null;
  if (survey === null) return { survey: null, selfAssessment, perception: null };
  if (selfAssessment === null) return { survey, selfAssessment: null, perception: survey };
  return { survey, selfAssessment, perception: (1 - alpha) * survey + alpha * selfAssessment };
}

// ---------------------------------------------------------------------------
// 2.2 Bukti objektif dan 2.3 Validasi
// ---------------------------------------------------------------------------

/**
 * E_c = rata-rata nilai asesor. PENILAI_TUNGGAL bila hanya satu asesor;
 * PERLU_REKONSILIASI bila selisih nilai terbesar dan terkecil lebih dari ambang.
 */
export function evidenceLayer(
  ratings: readonly { assessorId: string; level: number }[],
  disagreementThreshold: number,
): { value: number | null; flags: Flag[] } {
  if (ratings.length === 0) return { value: null, flags: [] };
  const levels = ratings.map((r) => r.level);
  const flags: Flag[] = [];
  if (new Set(ratings.map((r) => r.assessorId)).size === 1) flags.push("PENILAI_TUNGGAL");
  if (Math.max(...levels) - Math.min(...levels) > disagreementThreshold + EPS) {
    flags.push("PERLU_REKONSILIASI");
  }
  return { value: mean(levels), flags };
}

/** V_c = rata-rata antarsesi dari rata-rata nilai asesor per sesi; null bila tidak ada sesi. */
export function validationLayer(
  ratings: readonly { sessionId: string; level: number }[],
): number | null {
  const bySession = new Map<string, number[]>();
  for (const r of ratings) {
    const list = bySession.get(r.sessionId);
    if (list) list.push(r.level);
    else bySession.set(r.sessionId, [r.level]);
  }
  if (bySession.size === 0) return null;
  return mean([...bySession.values()].map(mean));
}

// ---------------------------------------------------------------------------
// 3. Indeks karakteristik
// ---------------------------------------------------------------------------

/** G_c dengan lapisan kosong dikeluarkan dan bobot sisanya dinormalisasi. */
export function combineLayers(
  p: number | null,
  e: number | null,
  v: number | null,
  weights: LayerWeights,
): LayerCombination {
  const available = (
    [
      [p, weights.perception],
      [e, weights.evidence],
      [v, weights.validation],
    ] as const
  ).filter((pair): pair is readonly [number, number] => pair[0] !== null);

  if (available.length === 0) return { combined: null, flags: ["SEMUA_LAPISAN_KOSONG"] };

  let num = 0;
  let den = 0;
  for (const [value, w] of available) {
    num += value * w;
    den += w;
  }
  return { combined: num / den, flags: available.length === 3 ? [] : ["LAPISAN_TIDAK_LENGKAP"] };
}

/**
 * Aturan selisih persepsi dan bukti: bila |P_c - E_c| >= ambang, F_c = min(G_c, E_c) dan
 * diberi tanda. Bila bukti lebih tinggi daripada persepsi, tanda tetap muncul tetapi nilai tidak berubah.
 */
export function scoreCharacteristic(
  p: number | null,
  e: number | null,
  v: number | null,
  options: { weights: LayerWeights; divergenceThreshold: number },
): CharacteristicScore {
  const { combined, flags } = combineLayers(p, e, v, options.weights);
  const divergence = p !== null && e !== null ? Math.abs(p - e) : null;
  let final = combined;
  if (divergence !== null && e !== null && divergence >= options.divergenceThreshold - EPS) {
    // combined tidak mungkin null di sini karena p dan e tersedia.
    final = Math.min(combined as number, e);
    flags.push("SELISIH_PERSEPSI_BUKTI");
  }
  return { combined, divergence, final, flags };
}

// ---------------------------------------------------------------------------
// 4. Agregasi
// ---------------------------------------------------------------------------

/** L = min(5, max(1, floor(O + EPS))). */
export function indicativeLevel(orgIndex: number): Level {
  return Math.max(1, Math.min(5, Math.floor(orgIndex + EPS))) as Level;
}

/** Tingkat L mantap bila min(I_a) >= L - 0,50 dan min(F_c non-kontekstual) >= L - 1,00. */
export function consolidation(
  level: number,
  minAspectIndex: number,
  minCharacteristicIndex: number,
  config: EngineParameters["consolidation"],
): boolean {
  return (
    minAspectIndex >= level - config.maxAspectBelowLevel - EPS &&
    minCharacteristicIndex >= level - config.maxCharacteristicBelowLevel - EPS
  );
}

/** Bobot aspek W_a = maxPointsStep5_a / jumlah poin aspek non-kontekstual (18.000). */
export function aspectWeights(params: EngineParameters): Map<string, number> {
  const levelAspects = params.aspects.filter((a) => !a.excludedFromLevel);
  const points = levelAspects.map((a) => {
    if (a.maxPointsStep5 === null || !(a.maxPointsStep5 > 0)) {
      throw new EngineInputError(`Aspek ${a.code} tidak memiliki poin maksimum tingkat 5`);
    }
    return a.maxPointsStep5;
  });
  const total = points.reduce((s, x) => s + x, 0);
  return new Map(levelAspects.map((a, i) => [a.code, points[i] / total]));
}

/** Nilai yang dipakai agregasi: penyesuaian panel bila ada, selain itu F_c. */
export function effectiveValue(c: Pick<CharacteristicResult, "final" | "panelAdjusted">): number | null {
  return c.panelAdjusted ?? c.final;
}

export function aggregate(
  characteristics: readonly CharacteristicResult[],
  params: EngineParameters,
  targetLevel: number,
): { aspects: Record<string, AspectResult>; organization: OrganizationResult } {
  const weights = aspectWeights(params);

  const valuesByAspect = new Map<string, number[]>([...weights.keys()].map((k) => [k, []]));
  const contextual: number[] = [];
  const missing: string[] = [];

  for (const c of characteristics) {
    const value = effectiveValue(c);
    if (c.isContextual) {
      if (value !== null) contextual.push(value);
      continue;
    }
    const bucket = valuesByAspect.get(c.aspectCode);
    if (!bucket) {
      throw new EngineInputError(`Karakteristik ${c.code} merujuk aspek ${c.aspectCode} yang tidak dikenal`);
    }
    if (value === null) missing.push(c.code);
    else bucket.push(value);
  }
  if (missing.length > 0) {
    throw new EngineInputError(`Karakteristik tanpa nilai akhir: ${missing.join(", ")}`);
  }

  const aspects: Record<string, AspectResult> = {};
  let orgIndex = 0;
  for (const [code, weight] of weights) {
    const values = valuesByAspect.get(code) as number[];
    if (values.length === 0) {
      throw new EngineInputError(`Aspek ${code} tidak memiliki karakteristik untuk dinilai`);
    }
    const index = mean(values);
    aspects[code] = { index, min: Math.min(...values), weight, gapToTarget: targetLevel - index };
    orgIndex += weight * index;
  }

  const level = indicativeLevel(orgIndex);
  const aspectEntries = Object.entries(aspects);
  const minAspectIndex = Math.min(...aspectEntries.map(([, a]) => a.index));
  const minCharacteristicIndex = Math.min(...aspectEntries.map(([, a]) => a.min));
  // Bila ada nilai sama, aspek yang lebih awal dalam urutan parameter dipilih.
  const priorityAspect = aspectEntries.reduce((best, cur) => (cur[1].index < best[1].index ? cur : best))[0];

  return {
    aspects,
    organization: {
      index: orgIndex,
      indicativeLevel: level,
      consolidated: consolidation(level, minAspectIndex, minCharacteristicIndex, params.consolidation),
      minAspectIndex,
      minCharacteristicIndex,
      gapToTarget: targetLevel - orgIndex,
      priorityAspect,
      contextualIndex: contextual.length > 0 ? mean(contextual) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Jalur setara Safety Culture Ladder
// ---------------------------------------------------------------------------

export function sclTrack(fulfillment: SclFulfillment, params: EngineParameters): SclTrackResult {
  const weights = aspectWeights(params);
  const thresholds = new Map(params.sclThresholds.map((t) => [t.step, t]));
  const steps = {} as Record<SclStep, SclStepResult>;
  let level: Level = 1;
  let chainOk = true;

  for (const step of SCL_STEPS) {
    const threshold = thresholds.get(step);
    if (!threshold) throw new EngineInputError(`Ambang jalur setara tingkat ${step} tidak tersedia`);

    let weightedAverage = 0;
    let minimum = Infinity;
    for (const [code, w] of weights) {
      const f = fulfillment[code]?.[step];
      if (f === undefined || !Number.isFinite(f) || f < 0 || f > 1) {
        throw new EngineInputError(`Pemenuhan aspek ${code} tingkat ${step} harus bernilai 0 sampai 1`);
      }
      weightedAverage += w * f;
      minimum = Math.min(minimum, f);
    }

    const passed =
      weightedAverage >= threshold.minWeightedAverage - EPS && minimum >= threshold.minPerAspect - EPS;
    steps[step] = {
      weightedAverage,
      minimum,
      thresholdAverage: threshold.minWeightedAverage,
      thresholdMinimum: threshold.minPerAspect,
      passed,
    };
    if (chainOk && passed) level = step;
    else chainOk = false;
  }

  return { steps, indicativeLevel: level };
}

// ---------------------------------------------------------------------------
// Penyusunan lapisan dari data mentah
// ---------------------------------------------------------------------------

function answersByStratumFor(
  responses: readonly SurveyResponseInput[],
  characteristicCode: string,
  stratumFilter?: ReadonlySet<string>,
): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const r of responses) {
    if (r.excluded) continue;
    if (stratumFilter && !stratumFilter.has(r.stratumCode)) continue;
    if (!(characteristicCode in r.characteristicAnswers)) continue;
    const answer = r.characteristicAnswers[characteristicCode];
    if (answer !== null) assertLevel(answer, `Jawaban survei ${characteristicCode}`);
    (out[r.stratumCode] ??= []).push(answer);
  }
  return out;
}

function populationMap(strata: readonly StratumInput[]): Record<string, number> {
  return Object.fromEntries(strata.map((s) => [s.code, s.population]));
}

/** Menghitung P_c, E_c, V_c, dan penyesuaian panel per karakteristik dari data mentah. */
export function buildCharacteristicInputs(
  raw: RawAssessmentInput,
  params: EngineParameters,
): CharacteristicInput[] {
  const population = populationMap(raw.strata);
  const submitted = raw.selfAssessments.filter((s) => s.status === "SUBMITTED");

  return raw.characteristics.map((def) => {
    const saLevels = submitted.map((s) => s.answers[def.code] ?? null);
    for (const l of saLevels) if (l !== null) assertLevel(l, `Penilaian mandiri ${def.code}`);

    const p = perception(
      answersByStratumFor(raw.surveyResponses, def.code),
      population,
      saLevels,
      params.selfAssessmentWeightInPerception,
    );

    const evidenceRatings = raw.evidenceRatings.filter((r) => r.characteristicCode === def.code);
    for (const r of evidenceRatings) assertLevel(r.level, `Nilai bukti ${def.code}`);
    const evidence = evidenceLayer(evidenceRatings, params.assessorDisagreementFlag);

    const validationRatings = raw.validationRatings.filter((r) => r.characteristicCode === def.code);
    for (const r of validationRatings) assertLevel(r.level, `Nilai validasi ${def.code}`);

    const panelAdjusted = raw.panelAdjustments?.[def.code] ?? null;
    if (panelAdjusted !== null) assertLevel(panelAdjusted, `Penyesuaian panel ${def.code}`);

    return {
      ...def,
      perception: p.perception,
      evidence: evidence.value,
      validation: validationLayer(validationRatings),
      panelAdjusted,
      flags: evidence.flags,
    };
  });
}

// ---------------------------------------------------------------------------
// Pintu masuk
// ---------------------------------------------------------------------------

export function runEngine(input: EngineInput, params: EngineParameters): EngineResult {
  const characteristics: CharacteristicResult[] = input.characteristics.map((c) => {
    const score = scoreCharacteristic(c.perception, c.evidence, c.validation, {
      weights: params.layerWeights,
      divergenceThreshold: params.divergenceThreshold,
    });
    return {
      code: c.code,
      aspectCode: c.aspectCode,
      isContextual: c.isContextual,
      perception: c.perception,
      evidence: c.evidence,
      validation: c.validation,
      combined: score.combined,
      divergence: score.divergence,
      final: score.final,
      panelAdjusted: c.panelAdjusted ?? null,
      flags: [...score.flags, ...(c.flags ?? [])],
    };
  });

  const { aspects, organization } = aggregate(characteristics, params, input.targetLevel);
  const result: EngineResult = { engineVersion: ENGINE_VERSION, characteristics, aspects, organization };
  if (input.sclFulfillment) result.sclTrack = sclTrack(input.sclFulfillment, params);
  return result;
}

export function scoreAssessment(raw: RawAssessmentInput, params: EngineParameters): EngineResult {
  return runEngine(
    {
      characteristics: buildCharacteristicInputs(raw, params),
      targetLevel: raw.targetLevel,
      sclFulfillment: raw.sclFulfillment,
    },
    params,
  );
}

// ---------------------------------------------------------------------------
// 6. Kesenjangan persepsi antarlapisan
// ---------------------------------------------------------------------------

/**
 * Per aspek: rata-rata skor survei kelompok MANAGEMENT dikurangi kelompok FIELD, dengan pembobotan
 * populasi dalam kelompok. Skor aspek suatu kelompok adalah rata-rata skor karakteristik
 * non-kontekstualnya, sejalan dengan I_a. Jumlah respons kelompok dihitung sebagai jumlah jawaban
 * selain "Tidak tahu" yang paling sedikit di antara karakteristik aspek itu; hasil disembunyikan
 * bila salah satu kelompok di bawah batas minimum (bawaan 5).
 */
export function perceptionGap(
  raw: Pick<RawAssessmentInput, "characteristics" | "strata" | "surveyResponses">,
  params: EngineParameters,
): Record<string, PerceptionGapResult> {
  const population = populationMap(raw.strata);
  const strataOf = (group: StratumGroup) =>
    new Set(raw.strata.filter((s) => s.group === group).map((s) => s.code));
  const groups = { management: strataOf("MANAGEMENT"), field: strataOf("FIELD") };

  const groupScore = (characteristicCodes: string[], strata: ReadonlySet<string>) => {
    let responses = characteristicCodes.length > 0 ? Infinity : 0;
    const scores: number[] = [];
    for (const code of characteristicCodes) {
      const answers = answersByStratumFor(raw.surveyResponses, code, strata);
      const valid = Object.values(answers).reduce((n, list) => n + list.filter((a) => a !== null).length, 0);
      responses = Math.min(responses, valid);
      const score = surveyScore(answers, population);
      if (score !== null) scores.push(score);
    }
    return { responses, value: scores.length === characteristicCodes.length && scores.length > 0 ? mean(scores) : null };
  };

  const out: Record<string, PerceptionGapResult> = {};
  for (const aspect of params.aspects.filter((a) => !a.excludedFromLevel)) {
    const codes = raw.characteristics
      .filter((c) => c.aspectCode === aspect.code && !c.isContextual)
      .map((c) => c.code);
    const m = groupScore(codes, groups.management);
    const f = groupScore(codes, groups.field);
    const suppressed =
      m.responses < params.minRespondentsPerReportCell || f.responses < params.minRespondentsPerReportCell;

    if (suppressed || m.value === null || f.value === null) {
      out[aspect.code] = {
        management: null,
        field: null,
        gap: null,
        attention: false,
        suppressed: true,
        managementResponses: m.responses,
        fieldResponses: f.responses,
      };
      continue;
    }
    const gap = m.value - f.value;
    out[aspect.code] = {
      management: m.value,
      field: f.value,
      gap,
      attention: gap >= params.perceptionGapAttention - EPS,
      suppressed: false,
      managementResponses: m.responses,
      fieldResponses: f.responses,
    };
  }
  return out;
}
