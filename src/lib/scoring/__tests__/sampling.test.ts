// Tes kalkulator sampel di luar fixture: validasi masukan dan pembulatan kebal floating point.

import { describe, expect, it } from "vitest";
import seedParameters from "../../../../seed/aspek-dan-parameter.json";
import { ceilSafe, EngineInputError, samplePlan, toEngineParameters } from "../index";

describe("ceilSafe", () => {
  it("setara ROUNDUP Excel dan kebal galat floating point", () => {
    // 0,07 x 100 = 7,000000000000001 dalam IEEE 754; Math.ceil memberi 8, ceilSafe memberi 7
    expect(Math.ceil(0.07 * 100)).toBe(8);
    expect(ceilSafe(0.07 * 100)).toBe(7);
    // 0,1 x 3 x 120 = 36,00000000000001; Math.ceil memberi 37, ceilSafe memberi 36
    expect(ceilSafe(0.1 * 3 * 120)).toBe(36);
    expect(ceilSafe(36.000001)).toBe(37);
    expect(ceilSafe(36)).toBe(36);
  });
});

describe("samplePlan", () => {
  it("sasaran strata tidak melebihi populasinya", () => {
    // Strata 3 orang dari 3.000 pekerja: ceilSafe(0,001 x 353) = 1, ceilSafe(0,3 x 3) = 1, min(3, 1) = 1
    // Strata 2.997: ceilSafe(0,999 x 353) = 353, ceilSafe(0,3 x 2997) = 900, min(2997, 900) = 900
    const plan = samplePlan({
      workers: 3000,
      projects: 1,
      locations: 1,
      strata: [
        { code: "S1", population: 3 },
        { code: "S2", population: 2997 },
      ],
    });
    expect(plan.strata.map((s) => s.surveyTarget)).toEqual([1, 900]);
    expect(plan.projectsToVisit).toBe(1);
    expect(plan.locationsToVisit).toBe(1);
  });

  it("minimal satu proyek dikunjungi walau tidak ada proyek berjalan", () => {
    expect(samplePlan({ workers: 50, projects: 0, locations: 0, strata: [] }).projectsToVisit).toBe(1);
  });

  it("menolak jumlah pekerja, proyek, lokasi, atau populasi yang bukan bilangan bulat tak negatif", () => {
    expect(() => samplePlan({ workers: 0, projects: 1, locations: 1, strata: [] })).toThrow(EngineInputError);
    expect(() => samplePlan({ workers: 10.5, projects: 1, locations: 1, strata: [] })).toThrow(EngineInputError);
    expect(() => samplePlan({ workers: 10, projects: -1, locations: 1, strata: [] })).toThrow(EngineInputError);
    expect(() =>
      samplePlan({ workers: 10, projects: 1, locations: 1, strata: [{ code: "S1", population: -5 }] }),
    ).toThrow(/S1/);
  });
});

describe("toEngineParameters", () => {
  it("menolak tingkat ambang jalur setara yang tidak dikenal", () => {
    const snapshot = {
      ...seedParameters,
      sclThresholds: [...seedParameters.sclThresholds, { step: 6, criteria: 0, minWeightedAverage: 0.9, minPerAspect: 0.8 }],
    };
    expect(() => toEngineParameters(snapshot)).toThrow(/6/);
  });

  it("aspek kontekstual tanpa poin dipetakan sebagai dikecualikan dari tingkat", () => {
    const params = toEngineParameters(seedParameters);
    expect(params.aspects.find((a) => a.code === "KT")).toEqual({ code: "KT", maxPointsStep5: null, excludedFromLevel: true });
    expect(params.aspects.find((a) => a.code === "A1")?.maxPointsStep5).toBe(4800);
  });
});
