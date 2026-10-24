import { describe, expect, it } from "vitest";
import seedParameters from "../../../../seed/aspek-dan-parameter.json";
import simulation from "../../../../seed/fixtures/skoring-simulasi.json";
import { runEngine, toEngineParameters } from "@/lib/scoring";
import { buildScoringInput, sclAspectCodes, sclFulfillmentFrom, toRawInput, withPanelAdjustments, type ScoringRows } from "../engine-input";
import { isValidPanelValue, panelAdjustmentSchema, visibleOtherRatings } from "../rules";

const params = toEngineParameters(seedParameters);
const chars = simulation.input.characteristics;

function rows(overrides: Partial<ScoringRows> = {}): ScoringRows {
  return {
    characteristics: chars.map((c) => ({ id: `id-${c.code}`, code: c.code, aspectCode: c.aspectCode, isContextual: c.isContextual })),
    strata: [
      { id: "st4", code: "S4", group: "FIELD", population: 200 },
      { id: "st5", code: "S5", group: "FIELD", population: 300 },
    ],
    // Satu respons per strata: S4 = P - 0,6 dan S5 = P + 0,4, sehingga rata-rata berbobot 0,4 dan 0,6 sama dengan P.
    responses: [
      { stratumId: "st4", answers: chars.map((c) => ({ characteristicId: `id-${c.code}`, level: c.p - 0.6 })) },
      { stratumId: "st5", answers: chars.map((c) => ({ characteristicId: `id-${c.code}`, level: c.p + 0.4 })) },
    ],
    selfAssessments: [],
    evidenceRatings: chars.flatMap((c) => ["a", "b"].map((assessorId) => ({ characteristicId: `id-${c.code}`, assessorId, level: c.e }))),
    validationRatings: chars.map((c) => ({ sessionId: "v1", characteristicId: `id-${c.code}`, assessorId: "a", level: c.v })),
    scl: Object.entries(simulation.input.sclFulfillment).flatMap(([aspectCode, steps]) => Object.entries(steps).map(([step, f]) => ({ aspectCode, step: Number(step), percent: f * 100 }))),
    targetLevel: 4,
    ...overrides,
  };
}

describe("penyusunan masukan mesin dari baris basis data", () => {
  it("menghasilkan indeks organisasi 3,143463 dan jalur setara tingkat 3", () => {
    const input = buildScoringInput(rows(), params);
    const result = runEngine(input.engineInput, params);
    expect(result.organization.index).toBeCloseTo(3.143463, 6);
    expect(result.sclTrack?.indicativeLevel).toBe(3);
    expect(input.sclComplete).toBe(true);
    expect(input.sources["K1.1"]).toMatchObject({ surveyAnswers: 2, dontKnow: 0, evidenceAssessors: 2, evidenceMin: 3, evidenceMax: 3, validationSessions: 1 });
    expect(input.sources["K1.1"]?.survey).toBeCloseTo(3.6, 12);
    expect(input.strata).toEqual([
      { code: "S4", group: "FIELD", population: 200, responses: 1 },
      { code: "S5", group: "FIELD", population: 300, responses: 1 },
    ]);
  });

  it("penilaian mandiri masuk ke persepsi dengan bobot alfa", () => {
    const input = buildScoringInput(rows({ selfAssessments: [{ answers: [{ characteristicId: "id-K1.1", level: 5 }] }] }), params);
    const k11 = input.engineInput.characteristics.find((c) => c.code === "K1.1");
    expect(k11?.perception).toBeCloseTo(0.7 * 3.6 + 0.3 * 5, 12);
    expect(input.sources["K1.1"]).toMatchObject({ selfAssessments: 1, selfAssessment: 5 });
    expect(input.sources["K1.2"]).toMatchObject({ selfAssessments: 0, selfAssessment: null });
  });

  it("jalur setara dihilangkan bila belum lengkap; persen diubah ke 0 sampai 1", () => {
    const partial = rows().scl.filter((r) => !(r.aspectCode === "A6" && r.step === 5));
    expect(sclFulfillmentFrom(partial, sclAspectCodes(params))).toBeNull();
    const input = buildScoringInput(rows({ scl: partial }), params);
    expect(input.sclComplete).toBe(false);
    expect(runEngine(input.engineInput, params).sclTrack).toBeUndefined();
    expect(sclFulfillmentFrom(rows().scl, sclAspectCodes(params))?.A1?.[2]).toBeCloseTo(0.92, 12);
    expect(sclAspectCodes(params)).toEqual(["A1", "A2", "A3", "A4", "A5", "A6"]);
  });

  it("strata respons harus ada di snapshot; jawaban untuk karakteristik asing diabaikan", () => {
    expect(() => toRawInput(rows({ responses: [{ stratumId: "lain", answers: [] }] }), params)).toThrow(/stratum/);
    const raw = toRawInput(rows({ responses: [{ stratumId: "st4", answers: [{ characteristicId: "asing", level: 3 }] }] }), params);
    expect(raw.surveyResponses[0]?.characteristicAnswers).toEqual({});
  });

  it("penyesuaian panel dipakai untuk agregasi; nilai mesin tetap", () => {
    const input = buildScoringInput(rows(), params);
    const adjusted = runEngine(withPanelAdjustments(input.engineInput, { "K1.3": 2.6 }), params);
    const k13 = adjusted.characteristics.find((c) => c.code === "K1.3");
    expect(k13?.final).toBeCloseTo(2, 12);
    expect(k13?.panelAdjusted).toBe(2.6);
    expect(adjusted.organization.index).toBeCloseTo(3.143463 + 0.2 * (4800 / 18000), 6);
  });
});

describe("aturan penilaian asesor dan panel", () => {
  it("nilai asesor lain tersembunyi sampai asesor menyimpan nilainya", () => {
    const ratings = [
      { assessorId: "a", level: 3 },
      { assessorId: "b", level: 4 },
    ];
    expect(visibleOtherRatings(ratings, "c")).toEqual({ own: null, others: [], hiddenCount: 2 });
    expect(visibleOtherRatings(ratings, "a")).toEqual({ own: ratings[0], others: [ratings[1]], hiddenCount: 0 });
  });

  it("nilai panel 1,00 sampai 5,00 dengan paling banyak dua desimal", () => {
    expect([1, 2.6, 3.25, 5, 0.1 + 0.2 + 2].map(isValidPanelValue)).toEqual([true, true, true, true, true]);
    expect([0.99, 5.01, 2.555, Number.NaN].map(isValidPanelValue)).toEqual([false, false, false, false]);
    expect(panelAdjustmentSchema.safeParse({ characteristicCode: "KT.1", adjustedValue: "3", rationale: "Alasan panel yang cukup panjang." }).success).toBe(true);
  });
});
