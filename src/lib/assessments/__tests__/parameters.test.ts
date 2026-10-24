import { describe, expect, it } from "vitest";
import seedParameters from "../../../../seed/aspek-dan-parameter.json";
import { toEngineParameters } from "@/lib/scoring";
import { CONSENT_TEMPLATES, renderConsent } from "../consent";
import { applyEdits, aspectWeights, draftFromDefaults, editableParametersSchema, editablePart, parseDecimal } from "../parameters";
import { flattenUnitTree, wouldCreateCycle } from "../unit-tree";

const draft = draftFromDefaults(seedParameters);

describe("draf parameter dari parameter bawaan instrumen", () => {
  it("tanpa kunci catatan dan tanpa hasil kalkulator", () => {
    expect(draft).not.toHaveProperty("_catatan");
    expect(draft.samplePlan).toBeNull();
    expect(draft.layerWeights).toEqual({ perception: 0.35, evidence: 0.4, validation: 0.25 });
    expect(draft.defaultStrata).toHaveLength(5);
  });

  it("dapat dipakai langsung oleh mesin penilaian sebagai snapshot", () => {
    const { samplePlan, ...snapshot } = draft;
    void samplePlan;
    const engine = toEngineParameters(snapshot as never);
    expect(engine.selfAssessmentWeightInPerception).toBe(0.3);
    expect(engine.aspects.find((a) => a.code === "A1")?.maxPointsStep5).toBe(4800);
  });

  it("bobot aspek sama dengan docs/03 bagian 4 dan berjumlah 1", () => {
    const weights = aspectWeights(draft);
    expect(weights.map((w) => [w.code, Number((w.weight * 100).toFixed(2))])).toEqual([
      ["A1", 26.67],
      ["A2", 10],
      ["A3", 19.17],
      ["A4", 17.78],
      ["A5", 21.94],
      ["A6", 4.44],
    ]);
    expect(weights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1, 12);
  });
});

describe("validasi parameter yang dapat diubah", () => {
  const base = editablePart(draft);

  it("parameter bawaan valid", () => {
    expect(editableParametersSchema.safeParse(base).success).toBe(true);
  });

  it("jumlah bobot lapisan harus 1", () => {
    const result = editableParametersSchema.safeParse({ ...base, layerWeights: { perception: 0.4, evidence: 0.4, validation: 0.25 } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("LAYER_WEIGHTS_SUM");
  });

  it("minimal responden per sel laporan tidak dapat kurang dari 5 (CLAUDE.md aturan 3)", () => {
    expect(editableParametersSchema.safeParse({ ...base, quality: { ...base.quality, minRespondentsPerReportCell: 4 } }).success).toBe(false);
    expect(editableParametersSchema.safeParse({ ...base, quality: { ...base.quality, minRespondentsPerReportCell: 7 } }).success).toBe(true);
  });

  it("ambang jalur setara harus tingkat 2 sampai 5 berurutan", () => {
    const shuffled = [...base.sclThresholds].reverse();
    expect(editableParametersSchema.safeParse({ ...base, sclThresholds: shuffled }).success).toBe(false);
  });
});

describe("penerapan perubahan", () => {
  const withPlan = { ...draft, samplePlan: { projects: 40, locations: 12, computedAt: "2026-10-24T00:00:00Z", result: {} as never } };

  it("mengubah bobot penilaian mandiri tanpa membatalkan hasil kalkulator", () => {
    const edited = applyEdits(withPlan, { ...editablePart(withPlan), selfAssessmentWeightInPerception: 0.25 });
    expect(edited.selfAssessmentWeightInPerception).toBe(0.25);
    expect(edited.samplePlan).not.toBeNull();
    // Kunci yang tidak dapat diubah tetap ada.
    expect(edited.aspects).toEqual(draft.aspects);
    expect(edited.sampling.sclInterviewFactorManagement).toBe(0.6);
  });

  it("mengubah parameter sampel membatalkan hasil kalkulator", () => {
    const base = editablePart(withPlan);
    const edited = applyEdits(withPlan, { ...base, sampling: { ...base.sampling, marginOfError: 0.04 } });
    expect(edited.samplePlan).toBeNull();
    expect(edited.sampling.marginOfError).toBe(0.04);
  });
});

describe("angka desimal dari formulir", () => {
  it("menerima koma atau titik desimal", () => {
    expect(parseDecimal("0,35")).toBe(0.35);
    expect(parseDecimal(" 0.35 ")).toBe(0.35);
    expect(parseDecimal("-6,2088")).toBe(-6.2088);
    expect(parseDecimal("5")).toBe(5);
  });

  it("menolak isian yang bukan angka tunggal", () => {
    for (const bad of ["", "abc", "1.000,5", "0,3,5", null, undefined]) expect(parseDecimal(bad as never)).toBeNull();
  });
});

describe("pohon unit", () => {
  const units = [
    { id: "p2", parentId: "d1", name: "Proyek Bendungan" },
    { id: "hq", parentId: null, name: "Kantor Pusat" },
    { id: "d1", parentId: "hq", name: "Divisi Gedung" },
    { id: "p1", parentId: "d1", name: "Proyek Apartemen" },
    { id: "orphan", parentId: "tidak-ada", name: "Cabang Lama" },
  ];

  it("urut induk lalu anak, nama sesuai abjad, dengan kedalaman", () => {
    expect(flattenUnitTree(units).map((u) => [u.id, u.depth])).toEqual([
      ["orphan", 0],
      ["hq", 0],
      ["d1", 1],
      ["p1", 2],
      ["p2", 2],
    ]);
  });

  it("mendeteksi siklus", () => {
    expect(wouldCreateCycle(units, "hq", "p1")).toBe(true);
    expect(wouldCreateCycle(units, "d1", "d1")).toBe(true);
    expect(wouldCreateCycle(units, "p1", "hq")).toBe(false);
    expect(wouldCreateCycle(units, "p1", null)).toBe(false);
  });
});

describe("teks persetujuan responden (docs/04 bagian 8)", () => {
  it("mengisi nama organisasi dan masa simpan", () => {
    const text = renderConsent("id", { organizationName: "PT Contoh Konstruksi", retentionMonths: 36 });
    expect(text).toContain("atas permintaan PT Contoh Konstruksi");
    expect(text).toContain("dimusnahkan setelah 36 bulan");
    expect(text).toContain("Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi");
    expect(text).not.toMatch(/[{}]/);
  });

  it("tanpa tanda pisah panjang di kedua bahasa", () => {
    for (const template of Object.values(CONSENT_TEMPLATES)) expect(template).not.toMatch(/[–—]/);
  });
});
