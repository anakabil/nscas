// Tes fixture mesin penilaian. Fixture di seed/fixtures/ adalah sumber kebenaran
// (dibuat oleh seed/fixtures/referensi_skoring.py). Bila hasil berbeda, yang salah adalah kode.

import { describe, expect, it } from "vitest";
import kasusTepi from "../../../../seed/fixtures/kasus-tepi.json";
import sampel3000 from "../../../../seed/fixtures/sampel-3000.json";
import skoringSimulasi from "../../../../seed/fixtures/skoring-simulasi.json";
import seedParameters from "../../../../seed/aspek-dan-parameter.json";
import {
  cronbachAlpha,
  indicativeLevel,
  perception,
  rwgSingle,
  runEngine,
  samplePlan,
  scoreCharacteristic,
  toEngineParameters,
  type CharacteristicInput,
  type SclFulfillment,
} from "../index";

const TOLERANCE = 1e-6;

/**
 * Membandingkan setiap nilai pada `expected` dengan `actual` secara rekursif.
 * Angka dibandingkan dengan toleransi 1e-6; nilai lain harus sama persis. Kunci tambahan
 * pada `actual` yang tidak ada di fixture tidak dinilai. Mengembalikan jumlah nilai yang diperiksa.
 */
function expectMatchesFixture(actual: unknown, expected: unknown, path = "$"): number {
  if (typeof expected === "number") {
    expect(typeof actual, `${path} harus angka`).toBe("number");
    const diff = Math.abs((actual as number) - expected);
    expect(diff, `${path}: ${actual} berbeda dari fixture ${expected}`).toBeLessThanOrEqual(TOLERANCE);
    return 1;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} harus larik`).toBe(true);
    expect((actual as unknown[]).length, `${path} panjang larik`).toBe(expected.length);
    return expected.reduce<number>(
      (n, item, i) => n + expectMatchesFixture((actual as unknown[])[i], item, `${path}[${i}]`),
      0,
    );
  }
  if (expected !== null && typeof expected === "object") {
    expect(actual !== null && typeof actual === "object", `${path} harus objek`).toBe(true);
    let n = 0;
    for (const [key, value] of Object.entries(expected)) {
      if (key.startsWith("_")) continue; // catatan, bukan nilai
      expect(actual as object, `${path}.${key} tidak ada`).toHaveProperty([key]);
      n += expectMatchesFixture((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
    }
    return n;
  }
  expect(actual, path).toEqual(expected);
  return 1;
}

/** Jumlah nilai daun pada fixture (tanpa kunci catatan), untuk memastikan tidak ada yang terlewat. */
function countLeaves(value: unknown): number {
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countLeaves(v), 0);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).reduce((n, [k, v]) => (k.startsWith("_") ? n : n + countLeaves(v)), 0);
  }
  return 1;
}

const params = toEngineParameters(seedParameters);
const layerOptions = { weights: params.layerWeights, divergenceThreshold: params.divergenceThreshold };

describe("parameter seed selaras dengan rujukan Python", () => {
  it("bobot lapisan dan ambang selisih sama dengan fixture simulasi", () => {
    expectMatchesFixture(
      { layerWeights: params.layerWeights, divergenceThreshold: params.divergenceThreshold },
      {
        layerWeights: skoringSimulasi.parameters.layerWeights,
        divergenceThreshold: skoringSimulasi.parameters.divergenceThreshold,
      },
    );
  });
});

describe("fixture skoring-simulasi.json (lembar 08 Simulasi Skoring)", () => {
  const characteristics: CharacteristicInput[] = skoringSimulasi.input.characteristics.map((c) => ({
    code: c.code,
    aspectCode: c.aspectCode,
    isContextual: c.isContextual,
    perception: c.p,
    evidence: c.e,
    validation: c.v,
  }));
  const result = runEngine(
    {
      characteristics,
      targetLevel: skoringSimulasi.parameters.targetLevel,
      sclFulfillment: skoringSimulasi.input.sclFulfillment as unknown as SclFulfillment,
    },
    params,
  );

  it("setiap nilai karakteristik, aspek, organisasi, dan jalur setara SCL sesuai fixture", () => {
    const checked = expectMatchesFixture(result, skoringSimulasi.expected);
    expect(checked).toBe(countLeaves(skoringSimulasi.expected));
  });

  it("indeks organisasi 3,143463, tingkat 3, mantap, aspek prioritas A1, indeks kontekstual 3,165", () => {
    expect(result.organization.index).toBeCloseTo(3.143463, 6);
    expect(result.organization.indicativeLevel).toBe(3);
    expect(result.organization.consolidated).toBe(true);
    expect(result.organization.priorityAspect).toBe("A1");
    expect(result.organization.contextualIndex).toBeCloseTo(3.165, 6);
    expect(result.sclTrack?.indicativeLevel).toBe(3);
  });
});

describe("fixture sampel-3000.json (lembar 09 Kalkulator Sampel)", () => {
  const { expected } = sampel3000;
  const plan = samplePlan({
    workers: expected.inputs.M,
    projects: expected.inputs.projects,
    locations: expected.inputs.locations,
    z: expected.inputs.z,
    marginOfError: expected.inputs.e,
    proportion: expected.inputs.p,
    minParticipation: expected.inputs.minParticipation,
    interviewFactorManagement: seedParameters.sampling.sclInterviewFactorManagement,
    interviewFactorOperational: seedParameters.sampling.sclInterviewFactorOperational,
    projectFactor: seedParameters.sampling.sclProjectFactor,
    strata: expected.strata.map(({ code, name, population }) => ({ code, name, population })),
  });

  it("setiap nilai kalkulator sampel sesuai fixture", () => {
    expect(expectMatchesFixture(plan, expected)).toBe(countLeaves(expected));
  });

  it("menghasilkan 33, 66, 353, 341, dan sasaran 901 untuk 3.000 pekerja", () => {
    expect(plan.sclMinimumInterviewManagement).toBe(33);
    expect(plan.sclMinimumInterviewOperational).toBe(66);
    expect(plan.slovin).toBe(353);
    expect(plan.cochranCorrected).toBe(341);
    expect(plan.surveyTargetTotal).toBe(901);
  });
});

describe("fixture kasus-tepi.json", () => {
  const charCases = [
    "contohDeck",
    "selisihTepatSatu",
    "selisihDiBawahSatu",
    "buktiLebihTinggiDariPersepsi",
    "validasiKosong",
  ] as const;

  it.each(charCases)("%s", (name) => {
    const { input, expected } = kasusTepi[name];
    expectMatchesFixture(scoreCharacteristic(input.p, input.e, input.v, layerOptions), expected);
  });

  it("tingkatDibatasiLima", () => {
    expect(indicativeLevel(kasusTepi.tingkatDibatasiLima.input.orgIndex)).toBe(
      kasusTepi.tingkatDibatasiLima.expected,
    );
  });

  it("tingkatPembulatanFloatingPoint", () => {
    const { input, expected } = kasusTepi.tingkatPembulatanFloatingPoint;
    expect(indicativeLevel(input.orgIndex)).toBe(expected);
    // Nilai asli sebelum fixture dibulatkan ke enam desimal oleh referensi_skoring.py.
    expect(indicativeLevel(2.9999999999999996)).toBe(expected);
  });

  it.each(["persepsiPembobotanStrata", "persepsiTanpaPenilaianMandiri"] as const)("%s", (name) => {
    const { input, expected } = kasusTepi[name];
    expectMatchesFixture(
      perception(
        input.answersByStratum as Record<string, (number | null)[]>,
        input.populationByStratum as Record<string, number>,
        input.selfAssessmentLevels,
        input.alpha,
      ),
      expected,
    );
  });

  it.each(["rwgSatuButir", "rwgSebaranLebar"] as const)("%s", (name) => {
    const { input, expected } = kasusTepi[name];
    expectMatchesFixture(rwgSingle(input.values), expected);
  });

  it("alphaCronbach", () => {
    const { input, expected } = kasusTepi.alphaCronbach;
    expectMatchesFixture(cronbachAlpha(input.matrix), expected);
  });
});
