// Tes mesin penilaian untuk bagian yang tidak tercakup fixture, dengan nilai yang dihitung tangan.

import { describe, expect, it } from "vitest";
import kasusTepi from "../../../../seed/fixtures/kasus-tepi.json";
import skoringSimulasi from "../../../../seed/fixtures/skoring-simulasi.json";
import seedParameters from "../../../../seed/aspek-dan-parameter.json";
import {
  aggregate,
  buildCharacteristicInputs,
  combineLayers,
  consolidation,
  ENGINE_VERSION,
  EngineInputError,
  evidenceLayer,
  perceptionGap,
  runEngine,
  sclTrack,
  scoreAssessment,
  surveyScore,
  toEngineParameters,
  validationLayer,
  type CharacteristicInput,
  type EngineParameters,
  type RawAssessmentInput,
  type SclFulfillment,
  type StratumInput,
  type SurveyResponseInput,
} from "../index";

const params = toEngineParameters(seedParameters);

const STRATA: StratumInput[] = [
  { code: "S1", group: "MANAGEMENT", population: 15 },
  { code: "S2", group: "MANAGEMENT", population: 120 },
  { code: "S3", group: "SUPERVISORY", population: 300 },
  { code: "S4", group: "FIELD", population: 1800 },
  { code: "S5", group: "FIELD", population: 765 },
];

const simulationCharacteristics: CharacteristicInput[] = skoringSimulasi.input.characteristics.map((c) => ({
  code: c.code,
  aspectCode: c.aspectCode,
  isContextual: c.isContextual,
  perception: c.p,
  evidence: c.e,
  validation: c.v,
}));

function response(stratumCode: string, answers: Record<string, number | null>, excluded = false): SurveyResponseInput {
  return { stratumCode, excluded, characteristicAnswers: answers };
}

describe("lapisan bukti", () => {
  it("rata-rata nilai asesor tanpa tanda bila dua asesor sepakat", () => {
    // (3,0 + 2,5) / 2 = 2,75; selisih 0,5 tidak lebih dari 1,00
    expect(evidenceLayer([{ assessorId: "a", level: 3 }, { assessorId: "b", level: 2.5 }], 1)).toEqual({
      value: 2.75,
      flags: [],
    });
  });

  it("PENILAI_TUNGGAL bila hanya satu asesor", () => {
    expect(evidenceLayer([{ assessorId: "a", level: 3.5 }], 1)).toEqual({ value: 3.5, flags: ["PENILAI_TUNGGAL"] });
  });

  it("PERLU_REKONSILIASI bila selisih lebih dari 1,00, tidak pada selisih tepat 1,00", () => {
    // 4,5 - 3,0 = 1,5 > 1,00
    expect(evidenceLayer([{ assessorId: "a", level: 3 }, { assessorId: "b", level: 4.5 }], 1).flags).toEqual([
      "PERLU_REKONSILIASI",
    ]);
    // 4,0 - 3,0 = 1,00, bukan "lebih dari"
    expect(evidenceLayer([{ assessorId: "a", level: 3 }, { assessorId: "b", level: 4 }], 1).flags).toEqual([]);
  });

  it("kosong bila belum ada penilaian", () => {
    expect(evidenceLayer([], 1)).toEqual({ value: null, flags: [] });
  });
});

describe("lapisan validasi", () => {
  it("rata-rata per sesi lalu rata-rata antarsesi", () => {
    // Sesi 1: (3,0 + 3,5) / 2 = 3,25; sesi 2: 2,5; V = (3,25 + 2,5) / 2 = 2,875
    // Bukan rata-rata seluruh nilai (3 + 3,5 + 2,5) / 3 = 3,0
    expect(
      validationLayer([
        { sessionId: "s1", level: 3 },
        { sessionId: "s1", level: 3.5 },
        { sessionId: "s2", level: 2.5 },
      ]),
    ).toBe(2.875);
  });

  it("kosong bila tidak ada sesi yang menilai", () => {
    expect(validationLayer([])).toBeNull();
  });
});

describe("gabungan lapisan", () => {
  it("SEMUA_LAPISAN_KOSONG bila tidak ada lapisan", () => {
    expect(combineLayers(null, null, null, params.layerWeights)).toEqual({
      combined: null,
      flags: ["SEMUA_LAPISAN_KOSONG"],
    });
  });

  it("hanya bukti: bobot dinormalisasi menjadi 1", () => {
    // 0,40 x 3,2 / 0,40 = 3,2 (dibandingkan dengan toleransi karena galat floating point)
    const result = combineLayers(null, 3.2, null, params.layerWeights);
    expect(result.combined).toBeCloseTo(3.2, 12);
    expect(result.flags).toEqual(["LAPISAN_TIDAK_LENGKAP"]);
  });
});

describe("skor survei berbobot populasi", () => {
  it("menolak strata tanpa populasi", () => {
    expect(() => surveyScore({ S9: [3] }, { S1: 15 })).toThrow(EngineInputError);
  });

  it("null bila semua jawaban Tidak tahu", () => {
    expect(surveyScore({ S1: [null, null] }, { S1: 15 })).toBeNull();
  });
});

describe("pembangun lapisan dari data mentah", () => {
  const { answersByStratum } = kasusTepi.persepsiPembobotanStrata.input as {
    answersByStratum: Record<string, (number | null)[]>;
  };
  const responses = Object.entries(answersByStratum).flatMap(([stratum, answers]) =>
    answers.map((a) => response(stratum, { "K1.1": a })),
  );

  const raw: RawAssessmentInput = {
    characteristics: [{ code: "K1.1", aspectCode: "A1", isContextual: false }],
    strata: STRATA,
    surveyResponses: [
      ...responses,
      // Respons yang dikeluarkan setelah ditinjau asesor tidak dihitung.
      response("S4", { "K1.1": 5 }, true),
    ],
    selfAssessments: [
      { status: "SUBMITTED", answers: { "K1.1": 4 } },
      { status: "SUBMITTED", answers: { "K1.1": 4 } },
      // Draf tidak dihitung.
      { status: "DRAFT", answers: { "K1.1": 1 } },
    ],
    evidenceRatings: [
      { characteristicCode: "K1.1", assessorId: "a", level: 3 },
      { characteristicCode: "K1.1", assessorId: "b", level: 2.5 },
    ],
    validationRatings: [
      { sessionId: "s1", characteristicCode: "K1.1", assessorId: "a", level: 3 },
      { sessionId: "s1", characteristicCode: "K1.1", assessorId: "b", level: 3.5 },
      { sessionId: "s2", characteristicCode: "K1.1", assessorId: "a", level: 2.5 },
    ],
    targetLevel: 4,
  };

  it("persepsi sama dengan fixture persepsiPembobotanStrata; bukti 2,75; validasi 2,875", () => {
    const [c] = buildCharacteristicInputs(raw, params);
    expect(c.perception).toBeCloseTo(kasusTepi.persepsiPembobotanStrata.expected.perception, 6);
    expect(c.evidence).toBe(2.75);
    expect(c.validation).toBe(2.875);
    expect(c.panelAdjusted).toBeNull();
    expect(c.flags).toEqual([]);
  });

  it("indeks karakteristik dari data mentah", () => {
    // P = 0,7 x 2,669251 + 0,3 x 4 = 3,068475; E = 2,75; V = 2,875
    // G = 0,35 x 3,068475 + 0,40 x 2,75 + 0,25 x 2,875 = 1,073966 + 1,1 + 0,71875 = 2,892716
    // |P - E| = 0,318 < 1,00, sehingga F = G
    const { characteristics } = runEngine(
      { characteristics: buildCharacteristicInputs(raw, params), targetLevel: 4 },
      { ...params, aspects: [{ code: "A1", maxPointsStep5: 4800, excludedFromLevel: false }] },
    );
    expect(characteristics[0].combined).toBeCloseTo(2.8927164, 6);
    expect(characteristics[0].final).toBeCloseTo(2.8927164, 6);
  });

  it("menolak nilai di luar rentang 1 sampai 5", () => {
    expect(() =>
      buildCharacteristicInputs(
        { ...raw, evidenceRatings: [{ characteristicCode: "K1.1", assessorId: "a", level: 6 }] },
        params,
      ),
    ).toThrow(EngineInputError);
    expect(() =>
      buildCharacteristicInputs({ ...raw, surveyResponses: [response("S1", { "K1.1": 0 })] }, params),
    ).toThrow(EngineInputError);
    expect(() =>
      buildCharacteristicInputs({ ...raw, panelAdjustments: { "K1.1": 5.5 } }, params),
    ).toThrow(EngineInputError);
  });
});

describe("scoreAssessment dari data mentah", () => {
  // Data mentah yang menghasilkan persis nilai P, E, V simulasi: satu responden strata S4 menjawab
  // nilai P, dua asesor memberi nilai E, dan satu sesi validasi memberi nilai V.
  // Nilai P simulasi bukan bilangan bulat, sehingga di sini dipakai dua responden yang rata-ratanya P.
  const defs = skoringSimulasi.input.characteristics;
  const raw: RawAssessmentInput = {
    characteristics: defs.map(({ code, aspectCode, isContextual }) => ({ code, aspectCode, isContextual })),
    strata: STRATA,
    surveyResponses: [
      response("S4", Object.fromEntries(defs.map((c) => [c.code, c.p - 0.2]))),
      response("S4", Object.fromEntries(defs.map((c) => [c.code, c.p + 0.2]))),
    ],
    selfAssessments: [],
    evidenceRatings: defs.flatMap((c) => [
      { characteristicCode: c.code, assessorId: "a", level: c.e },
      { characteristicCode: c.code, assessorId: "b", level: c.e },
    ]),
    validationRatings: defs.map((c) => ({ sessionId: "s1", characteristicCode: c.code, assessorId: "a", level: c.v })),
    targetLevel: 4,
    sclFulfillment: skoringSimulasi.input.sclFulfillment as unknown as SclFulfillment,
  };

  it("menghasilkan indeks organisasi 3,143463 dan tingkat 3 yang sama dengan fixture", () => {
    const result = scoreAssessment(raw, params);
    expect(result.engineVersion).toBe(ENGINE_VERSION);
    expect(result.organization.index).toBeCloseTo(skoringSimulasi.expected.organization.index, 6);
    expect(result.organization.indicativeLevel).toBe(3);
    expect(result.sclTrack?.indicativeLevel).toBe(3);
  });
});

describe("penyesuaian panel", () => {
  it("nilai panel dipakai untuk agregasi, nilai mesin tetap tersimpan", () => {
    // K1.3 F = 2,0 (aturan selisih). Panel menetapkan 2,6:
    // I_A1 = (3,26 + 3,14 + 2,6) / 3 = 3,0, naik 0,2 dari 2,8
    // O naik 0,2 x 4800/18000 = 0,053333, menjadi 3,143463 + 0,053333 = 3,196796
    const characteristics = simulationCharacteristics.map((c) =>
      c.code === "K1.3" ? { ...c, panelAdjusted: 2.6 } : c,
    );
    const result = runEngine({ characteristics, targetLevel: 4 }, params);
    const k13 = result.characteristics.find((c) => c.code === "K1.3");
    expect(k13?.final).toBeCloseTo(2.0, 12);
    expect(k13?.panelAdjusted).toBe(2.6);
    expect(result.aspects.A1.index).toBeCloseTo(3.0, 12);
    expect(result.organization.index).toBeCloseTo(3.143463 + 0.2 * (4800 / 18000), 6);
  });
});

describe("kemantapan tingkat", () => {
  const config = params.consolidation;

  it("mantap pada batas tepat, tidak mantap bila aspek terendah di bawah L - 0,50", () => {
    expect(consolidation(3, 2.5, 2.0, config)).toBe(true);
    expect(consolidation(3, 2.49, 2.5, config)).toBe(false);
  });

  it("tidak mantap bila karakteristik terendah di bawah L - 1,00", () => {
    expect(consolidation(3, 2.8, 1.99, config)).toBe(false);
  });
});

describe("agregasi menolak masukan tidak lengkap", () => {
  it("karakteristik tanpa nilai akhir", () => {
    const characteristics = simulationCharacteristics.map((c) =>
      c.code === "K2.1" ? { ...c, perception: null, evidence: null, validation: null } : c,
    );
    expect(() => runEngine({ characteristics, targetLevel: 4 }, params)).toThrow(/K2\.1/);
  });

  it("aspek tanpa karakteristik", () => {
    const characteristics = simulationCharacteristics.filter((c) => c.aspectCode !== "A6");
    expect(() => runEngine({ characteristics, targetLevel: 4 }, params)).toThrow(/A6/);
  });

  it("aspek yang tidak dikenal", () => {
    const characteristics = [
      ...simulationCharacteristics,
      { code: "K9.1", aspectCode: "A9", isContextual: false, perception: 3, evidence: 3, validation: 3 },
    ];
    expect(() => runEngine({ characteristics, targetLevel: 4 }, params)).toThrow(/A9/);
  });

  it("aspek tanpa poin maksimum", () => {
    const broken: EngineParameters = {
      ...params,
      aspects: params.aspects.map((a) => (a.code === "A2" ? { ...a, maxPointsStep5: null } : a)),
    };
    expect(() => aggregate([], broken, 4)).toThrow(/A2/);
  });

  it("indeks kontekstual null bila tidak ada karakteristik kontekstual", () => {
    const characteristics = simulationCharacteristics.filter((c) => !c.isContextual);
    expect(runEngine({ characteristics, targetLevel: 4 }, params).organization.contextualIndex).toBeNull();
  });
});

describe("jalur setara Safety Culture Ladder", () => {
  const full = (value: number) =>
    Object.fromEntries(
      ["A1", "A2", "A3", "A4", "A5", "A6"].map((a) => [a, { 2: value, 3: value, 4: value, 5: value }]),
    ) as SclFulfillment;

  it("semua aspek 100 persen menghasilkan tingkat 5", () => {
    expect(sclTrack(full(1), params).indicativeLevel).toBe(5);
  });

  it("tingkat 2 gagal menghasilkan tingkat 1", () => {
    expect(sclTrack(full(0.5), params).indicativeLevel).toBe(1);
  });

  it("harus lulus berurutan: tingkat 3 gagal tetapi tingkat 4 lulus tetap tingkat 2", () => {
    const f = full(0.9);
    for (const a of Object.keys(f)) f[a][3] = 0.6;
    const result = sclTrack(f, params);
    expect(result.steps[3].passed).toBe(false);
    expect(result.steps[4].passed).toBe(true);
    expect(result.indicativeLevel).toBe(2);
  });

  it("batas tepat ambang dinyatakan lulus", () => {
    // Semua aspek 0,75 pada tingkat 2: rata-rata tertimbang 0,75 >= 0,75 dan minimum 0,75 >= 0,70
    expect(sclTrack(full(0.75), params).steps[2].passed).toBe(true);
  });

  it("menolak pemenuhan yang hilang atau di luar 0 sampai 1, dan ambang yang hilang", () => {
    const missing = full(0.9);
    delete (missing as Record<string, unknown>).A3;
    expect(() => sclTrack(missing, params)).toThrow(/A3/);
    expect(() => sclTrack(full(80), params)).toThrow(EngineInputError);
    expect(() => sclTrack(full(0.9), { ...params, sclThresholds: params.sclThresholds.slice(0, 2) })).toThrow(
      /tingkat 4/,
    );
  });
});

describe("kesenjangan persepsi manajemen dan pelaksana", () => {
  const characteristics = [
    { code: "K1.1", aspectCode: "A1", isContextual: false },
    { code: "K1.2", aspectCode: "A1", isContextual: false },
    { code: "KT.1", aspectCode: "KT", isContextual: true },
  ];
  const r = (s: string, k11: number, k12: number) => response(s, { "K1.1": k11, "K1.2": k12, "KT.1": 1 });
  const surveyResponses = [
    r("S1", 4, 4),
    r("S1", 5, 4),
    r("S2", 4, 4),
    r("S2", 4, 4),
    r("S2", 3, 4),
    // Strata SUPERVISORY tidak masuk kedua kelompok.
    r("S3", 1, 1),
    r("S4", 3, 3),
    r("S4", 2, 3),
    r("S4", 3, 3),
    r("S5", 2, 3),
    r("S5", 3, 3),
  ];

  it("menghitung selisih berbobot populasi dan menandai selisih 0,50 atau lebih", () => {
    // K1.1 manajemen: S1 rata-rata 4,5 (populasi 15), S2 rata-rata 11/3 (populasi 120)
    //   (15 x 4,5 + 120 x 11/3) / 135 = (67,5 + 440) / 135 = 3,759259
    // K1.1 pelaksana: S4 rata-rata 8/3 (1800), S5 rata-rata 2,5 (765)
    //   (1800 x 8/3 + 765 x 2,5) / 2565 = (4800 + 1912,5) / 2565 = 2,616959
    // K1.2: manajemen 4, pelaksana 3
    // A1 manajemen (3,759259 + 4) / 2 = 3,879630; pelaksana (2,616959 + 3) / 2 = 2,808480
    // Selisih 1,071150 >= 0,50, ditandai
    const gap = perceptionGap({ characteristics, strata: STRATA, surveyResponses }, params);
    expect(gap.A1.suppressed).toBe(false);
    expect(gap.A1.management).toBeCloseTo(3.8796296, 6);
    expect(gap.A1.field).toBeCloseTo(2.8084795, 6);
    expect(gap.A1.gap).toBeCloseTo(1.0711501, 6);
    expect(gap.A1.attention).toBe(true);
    expect(gap.A1.managementResponses).toBe(5);
    expect(gap.A1.fieldResponses).toBe(5);
    expect(gap.KT).toBeUndefined();
  });

  it("disembunyikan bila salah satu kelompok kurang dari 5 respons", () => {
    const gap = perceptionGap(
      { characteristics, strata: STRATA, surveyResponses: surveyResponses.slice(0, -1) },
      params,
    );
    expect(gap.A1).toEqual({
      management: null,
      field: null,
      gap: null,
      attention: false,
      suppressed: true,
      managementResponses: 5,
      fieldResponses: 4,
    });
    // Aspek tanpa karakteristik dalam data juga disembunyikan.
    expect(gap.A2.suppressed).toBe(true);
    expect(gap.A2.managementResponses).toBe(0);
  });

  it("tidak ditandai bila selisih di bawah 0,50", () => {
    const flat = surveyResponses.map((x) => ({ ...x, characteristicAnswers: { "K1.1": 3, "K1.2": 3 } }));
    const gap = perceptionGap({ characteristics, strata: STRATA, surveyResponses: flat }, params);
    expect(gap.A1.gap).toBeCloseTo(0, 12);
    expect(gap.A1.attention).toBe(false);
  });
});
