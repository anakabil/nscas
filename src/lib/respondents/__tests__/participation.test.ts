import { describe, expect, it } from "vitest";
import { buildParticipation, maskCount, snapshotTrend, type ParticipationInput } from "../participation";

const base: ParticipationInput = {
  strata: [
    { id: "s-m", code: "M", name: "Manajemen", population: 40 },
    { id: "s-l", code: "L", name: "Pekerja lapangan", population: 600 },
  ],
  units: [
    { id: "u-hq", name: "Kantor Pusat", parentId: null },
    { id: "u-p1", name: "Proyek 1", parentId: "u-hq" },
    { id: "u-p2", name: "Proyek 2", parentId: "u-hq" },
  ],
  tokens: [
    { unitId: "u-hq", stratumId: "s-m", issued: 30, completed: 20 },
    { unitId: "u-p1", stratumId: "s-l", issued: 200, completed: 150 },
    { unitId: "u-p2", stratumId: "s-l", issued: 10, completed: 3 },
    { unitId: "u-p2", stratumId: null, issued: 6, completed: 0 },
  ],
  roster: [
    { unitId: "u-hq", stratumId: "s-m", count: 35 },
    { unitId: "u-p1", stratumId: "s-l", count: 300 },
    { unitId: "u-p2", stratumId: "s-l", count: 12 },
  ],
  minParticipation: 0.3,
  minCell: 5,
};

describe("ambang sel partisipasi", () => {
  it("menyembunyikan 1 sampai 4, menampilkan 0 dan 5 ke atas", () => {
    expect(maskCount(0, 5)).toEqual({ value: 0, suppressed: false });
    expect(maskCount(1, 5)).toEqual({ value: null, suppressed: true });
    expect(maskCount(4, 5)).toEqual({ value: null, suppressed: true });
    expect(maskCount(5, 5)).toEqual({ value: 5, suppressed: false });
  });
});

describe("partisipasi per strata dan unit", () => {
  const summary = buildParticipation(base);

  it("menghitung tingkat partisipasi strata terhadap populasi dan menandai di bawah 30 persen", () => {
    const [m, l] = summary.strata;
    expect(m).toMatchObject({ code: "M", registered: 35, issued: 30, completed: { value: 20, suppressed: false }, rate: 0.5, belowMinimum: false });
    expect(l).toMatchObject({ code: "L", registered: 312, issued: 210, completed: { value: 153 }, belowMinimum: true });
    expect(l?.rate).toBeCloseTo(153 / 600, 12);
    expect(summary.strataBelowMinimum).toBe(1);
  });

  it("menghitung partisipasi unit terhadap responden terdaftar dan menyembunyikan jumlah kecil", () => {
    const [hq, p1, p2] = summary.units;
    expect(hq).toMatchObject({ registered: 35, completed: { value: 20 } });
    expect(hq?.rate).toBeCloseTo(20 / 35, 12);
    expect(p1?.rate).toBeCloseTo(0.5, 12);
    expect(p2).toMatchObject({ registered: 12, issued: 16, completed: { value: null, suppressed: true }, rate: null });
  });

  it("menghitung total dan token kode QR yang belum memilih strata", () => {
    expect(summary.totals).toMatchObject({ population: 640, registered: 347, issued: 246, completed: { value: 173 } });
    expect(summary.totals.rate).toBeCloseTo(173 / 640, 12);
    expect(summary.pendingStratumSelection).toBe(6);
  });

  it("unit tanpa daftar responden tidak memiliki tingkat partisipasi", () => {
    const qrOnly = buildParticipation({ ...base, roster: [], tokens: [{ unitId: "u-p2", stratumId: "s-l", issued: 9, completed: 8 }] });
    expect(qrOnly.units.find((u) => u.unitId === "u-p2")).toMatchObject({ registered: 0, completed: { value: 8 }, rate: null });
  });

  it("strata dengan jumlah selesai disembunyikan tetap ditandai bila di bawah ambang", () => {
    const low = buildParticipation({ ...base, tokens: [{ unitId: "u-hq", stratumId: "s-m", issued: 4, completed: 2 }] });
    expect(low.strata[0]).toMatchObject({ completed: { suppressed: true }, rate: null, belowMinimum: true });
    expect(low.totals.completed.suppressed).toBe(true);
    expect(low.totals.rate).toBeNull();
  });
});

describe("tren harian", () => {
  it("menerapkan ambang sel pada cuplikan", () => {
    const trend = snapshotTrend(
      [
        { takenOn: new Date("2026-11-02T00:00:00Z"), data: { population: 640, issued: 10, completed: 3, strata: [] } },
        { takenOn: new Date("2026-11-03T00:00:00Z"), data: { population: 640, issued: 300, completed: 64, strata: [] } },
      ],
      5,
    );
    expect(trend).toEqual([
      { date: "2026-11-02", completed: { value: null, suppressed: true }, rate: null },
      { date: "2026-11-03", completed: { value: 64, suppressed: false }, rate: 0.1 },
    ]);
  });
});
