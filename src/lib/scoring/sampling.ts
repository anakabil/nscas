// Kalkulator sampel sesuai docs/03 bagian 7. Rujukan: sample_plan di seed/fixtures/referensi_skoring.py.

import { ceilSafe } from "./numeric";
import { EngineInputError } from "./types";

export interface SamplingStratumInput {
  code: string;
  population: number;
  [extra: string]: unknown;
}

export interface SamplingInput {
  /** M: jumlah pekerja dalam lingkup asesmen. */
  workers: number;
  /** N: jumlah proyek berjalan. */
  projects: number;
  /** X: jumlah lokasi. */
  locations: number;
  strata: SamplingStratumInput[];
  z?: number;
  marginOfError?: number;
  proportion?: number;
  minParticipation?: number;
  interviewFactorManagement?: number;
  interviewFactorOperational?: number;
  projectFactor?: number;
}

export type SamplingStratumResult<S extends SamplingStratumInput = SamplingStratumInput> = S & {
  proportion: number;
  surveyTarget: number;
};

export interface SamplePlan<S extends SamplingStratumInput = SamplingStratumInput> {
  inputs: {
    M: number;
    projects: number;
    locations: number;
    z: number;
    e: number;
    p: number;
    minParticipation: number;
  };
  sclMinimumInterviewManagement: number;
  sclMinimumInterviewOperational: number;
  sclMinimumInterviewTotal: number;
  slovin: number;
  cochranInitial: number;
  cochranCorrected: number;
  recommendedSurvey: number;
  projectsToVisit: number;
  locationsToVisit: number;
  strata: SamplingStratumResult<S>[];
  surveyTargetTotal: number;
}

function assertCount(value: number, name: string, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    throw new EngineInputError(`${name} harus bilangan bulat paling kecil ${min}`);
  }
}

export function samplePlan<S extends SamplingStratumInput>(
  input: Omit<SamplingInput, "strata"> & { strata: S[] },
): SamplePlan<S> {
  const {
    workers: M,
    projects,
    locations,
    z = 1.96,
    marginOfError: e = 0.05,
    proportion: p = 0.5,
    minParticipation = 0.3,
    interviewFactorManagement = 0.6,
    interviewFactorOperational = 1.2,
    projectFactor = 0.6,
  } = input;

  assertCount(M, "Jumlah pekerja", 1);
  assertCount(projects, "Jumlah proyek", 0);
  assertCount(locations, "Jumlah lokasi", 0);
  for (const s of input.strata) assertCount(s.population, `Populasi strata ${s.code}`, 0);

  const sclMgmt = ceilSafe(interviewFactorManagement * Math.sqrt(M));
  const sclOps = ceilSafe(interviewFactorOperational * Math.sqrt(M));
  const slovin = ceilSafe(M / (1 + M * e ** 2));
  const n0 = (z ** 2 * p * (1 - p)) / e ** 2;
  const cochran = ceilSafe(n0 / (1 + (n0 - 1) / M));
  const recommended = Math.max(slovin, cochran);

  const strata = input.strata.map((s) => {
    const proportion = s.population / M;
    const surveyTarget = Math.min(
      s.population,
      Math.max(ceilSafe(proportion * recommended), ceilSafe(minParticipation * s.population)),
    );
    return { ...s, proportion, surveyTarget };
  });

  return {
    inputs: { M, projects, locations, z, e, p, minParticipation },
    sclMinimumInterviewManagement: sclMgmt,
    sclMinimumInterviewOperational: sclOps,
    sclMinimumInterviewTotal: sclMgmt + sclOps,
    slovin,
    cochranInitial: n0,
    cochranCorrected: cochran,
    recommendedSurvey: recommended,
    projectsToVisit: Math.max(1, ceilSafe(projectFactor * Math.sqrt(projects))),
    locationsToVisit: ceilSafe(Math.sqrt(locations)),
    strata,
    surveyTargetTotal: strata.reduce((sum, s) => sum + s.surveyTarget, 0),
  };
}
