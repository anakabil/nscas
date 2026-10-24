import { describe, expect, it } from "vitest";
import { allVisibleMeetMinimum } from "@/lib/privacy/suppression";
import { aspectSurveyScore, buildHeatmap, cronbachByDimension, heatLevel, rwgByUnit, type DashboardResponse } from "../analytics";

const defs = [
  { code: "K1.1", aspectCode: "A1", isContextual: false },
  { code: "K1.2", aspectCode: "A1", isContextual: false },
  { code: "K2.1", aspectCode: "A2", isContextual: false },
  { code: "KT.1", aspectCode: "KT", isContextual: true },
];
const aspects = [
  { code: "A1", name: "Kepemimpinan" },
  { code: "A2", name: "Kebijakan" },
];

function response(unitId: string, stratumId: string, level: number | null, climate: number[] = []): DashboardResponse {
  return {
    unitId,
    stratumId,
    answers: { "K1.1": level, "K1.2": level === null ? null : level + 1 > 5 ? 5 : level + 1, "K2.1": level, "KT.1": 1 },
    climate: Object.fromEntries(climate.map((v, i) => [`i${i + 1}`, v])),
  };
}

describe("skor survei per aspek", () => {
  it("rata-rata karakteristik non-kontekstual; jumlah responden adalah jawaban paling sedikit", () => {
    const rs = [response("u1", "s4", 3), response("u1", "s4", 4), { ...response("u1", "s4", 2), answers: { "K1.1": 2, "K1.2": null, "K2.1": 2 } }];
    // K1.1: (3+4+2)/3 = 3; K1.2: (4+5)/2 = 4,5 -> A1 = 3,75 dengan n = 2
    expect(aspectSurveyScore(rs, defs, "A1")).toEqual({ value: 3.75, n: 2 });
    expect(aspectSurveyScore([], defs, "A1")).toEqual({ value: null, n: 0 });
    expect(aspectSurveyScore(rs, defs, "KT")).toEqual({ value: null, n: 0 });
  });

  it("warna peta mengikuti docs/05", () => {
    expect([3.3, 3.29, 2.8, 2.79].map(heatLevel)).toEqual(["good", "mid", "mid", "low"]);
  });
});

describe("peta warna tanpa titik data dari kurang dari 5 responden", () => {
  // S1 3 responden, S2 6 responden (manajemen); S4 8 responden (lapangan). Unit u2 hanya 2 responden.
  const responses = [
    ...Array.from({ length: 3 }, () => response("u1", "S1", 4)),
    ...Array.from({ length: 6 }, () => response("u1", "S2", 3)),
    ...Array.from({ length: 6 }, () => response("u1", "S4", 2)),
    ...Array.from({ length: 2 }, () => response("u2", "S4", 5)),
  ];
  const strata = ["S1", "S2", "S4"].map((key) => ({ key, label: key, match: (r: DashboardResponse) => r.stratumId === key }));
  const units = ["u1", "u2"].map((key) => ({ key, label: key, match: (r: DashboardResponse) => r.unitId === key }));

  it("strata: S1 disembunyikan, S2 ikut disembunyikan karena rata-rata kelompok manajemen diterbitkan", () => {
    const map = buildHeatmap(responses, defs, aspects, strata, 5, [["S1", "S2"], ["S4"]]);
    for (const row of map.rows) {
      expect(row.cells.map((c) => c.state)).toEqual(["suppressed", "secondary", "visible"]);
      expect(allVisibleMeetMinimum(row.cells, 5)).toBe(true);
    }
    // S4: K1.1 = (6 x 2 + 2 x 5) / 8 = 2,75; K1.2 = (6 x 3 + 2 x 5) / 8 = 3,5; A1 = 3,125
    expect(map.rows[0]?.cells[2]).toMatchObject({ value: 3.125, n: 8 });
  });

  it("unit: unit dengan 2 responden disembunyikan", () => {
    const map = buildHeatmap(responses, defs, aspects, units, 5);
    expect(map.rows[1]?.cells.map((c) => [c.state, c.n])).toEqual([
      ["visible", 15],
      ["suppressed", null],
    ]);
  });
});

describe("statistik mutu", () => {
  const dims = [{ code: "D1", name: "Komitmen", items: [{ id: "i1", reverseCoded: false }, { id: "i2", reverseCoded: false }, { id: "i3", reverseCoded: true }] }];
  const climate = [
    [4, 4, 2],
    [5, 5, 1],
    [3, 4, 3],
    [2, 2, 4],
    [4, 5, 2],
    [3, 3, 3],
  ];
  const responses = climate.map((c, i) => response(i < 4 ? "u1" : "u2", "S4", 3, c));

  it("alfa Cronbach per dimensi setelah butir negatif dibalik; disembunyikan bila kurang dari 5 respons lengkap", () => {
    const [d1] = cronbachByDimension(responses, dims, 5, 0.7);
    expect(d1?.alpha.value).toBeGreaterThan(0.9);
    expect(d1?.alpha.n).toBe(6);
    expect(cronbachByDimension(responses.slice(0, 4), dims, 5, 0.7)[0]?.alpha).toMatchObject({ value: null, n: null, state: "suppressed" });
  });

  it("rwg per unit; unit di bawah 5 responden disembunyikan", () => {
    const five = [...responses, response("u2", "S4", 3, [4, 4, 2]), response("u2", "S4", 3, [4, 4, 2]), response("u2", "S4", 3, [4, 4, 2])];
    const out = rwgByUnit(five, [{ id: "u1", name: "Unit 1" }, { id: "u2", name: "Unit 2" }, { id: "u3", name: "Unit 3" }], dims, 5, 0.7);
    expect(out.map((u) => u.unitId)).toEqual(["u1", "u2"]);
    expect(out[0]).toMatchObject({ n: null, average: null });
    expect(out[0]?.perDimension[0]?.state).toBe("suppressed");
    expect(out[1]?.n).toBe(5);
    expect(out[1]?.average).toBeGreaterThan(0.7);
  });
});
