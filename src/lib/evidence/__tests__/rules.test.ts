import { describe, expect, it } from "vitest";
import { buildChecklist } from "../rules";

const characteristics = [
  { id: "c1", code: "K1.1", name: "Keteladanan", requirements: [{ id: "r1", description: "Risalah rapat" }, { id: "r2", description: "Catatan kunjungan" }, { id: "r3", description: "Tinjauan manajemen" }] },
  { id: "c2", code: "K1.2", name: "Anggaran", requirements: [{ id: "r4", description: "Anggaran K3" }] },
  { id: "c3", code: "K1.3", name: "Penghargaan", requirements: [] },
];

describe("daftar periksa bukti per karakteristik", () => {
  it("menandai butir terpenuhi dan menghitung jenis bukti", () => {
    const rows = buildChecklist({
      characteristics,
      links: [
        { evidenceItemId: "e1", characteristicId: "c1", requirementIds: ["r1"] },
        { evidenceItemId: "e2", characteristicId: "c1", requirementIds: ["r1", "r2"] },
        { evidenceItemId: "e3", characteristicId: "c2", requirementIds: ["r4"] },
        { evidenceItemId: "e4", characteristicId: "c3", requirementIds: [] },
      ],
      minTypes: 2,
    });
    expect(rows[0]).toMatchObject({ evidenceCount: 2, types: 2, belowMinimum: false });
    expect(rows[0]?.requirements.map((r) => r.met)).toEqual([true, true, false]);
    expect(rows[1]).toMatchObject({ evidenceCount: 1, types: 1, belowMinimum: true });
    expect(rows[2]).toMatchObject({ evidenceCount: 1, types: 1, belowMinimum: true });
  });

  it("dua bukti tanpa butir daftar periksa dihitung satu jenis", () => {
    const rows = buildChecklist({
      characteristics,
      links: [
        { evidenceItemId: "e1", characteristicId: "c1", requirementIds: [] },
        { evidenceItemId: "e2", characteristicId: "c1", requirementIds: ["r-lain"] },
      ],
      minTypes: 2,
    });
    expect(rows[0]).toMatchObject({ types: 1, belowMinimum: true });
  });

  it("karakteristik tanpa bukti di bawah ambang", () => {
    expect(buildChecklist({ characteristics, links: [], minTypes: 2 }).every((r) => r.belowMinimum && r.types === 0)).toBe(true);
  });
});
