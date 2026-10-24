// Bagian murni skrip demo (scripts/demo/model.ts).

import { describe, expect, it } from "vitest";
import {
  allocateByWeight,
  createRandom,
  demoProjects,
  fixedEffects,
  generateResponse,
  LOCATIONS,
  samplePdf,
  STRATA_POPULATION,
  SURVEY_RESPONSES,
  weightedSample,
  wibLocal,
  workingTime,
  type InstrumentShape,
} from "../../scripts/demo/model";

const instrument: InstrumentShape = {
  characteristics: Array.from({ length: 18 }, (_, i) => ({ id: `c${i}`, code: `K${i}`, statements: [1, 2, 3, 4, 5].map((level) => ({ id: `c${i}-l${level}`, level })) })),
  climateItems: Array.from({ length: 21 }, (_, i) => ({ id: `d${i}`, dimension: `D${Math.floor(i / 3) + 1}`, reverseCoded: i % 3 === 2 })),
};

describe("struktur demo", () => {
  it("3.000 pekerja dan 900 respons sesuai sasaran kalkulator sampel", () => {
    expect(Object.values(STRATA_POPULATION).reduce((s, n) => s + n, 0)).toBe(3000);
    expect(Object.values(SURVEY_RESPONSES).reduce((s, n) => s + n, 0)).toBe(900);
    for (const code of Object.keys(SURVEY_RESPONSES) as (keyof typeof SURVEY_RESPONSES)[]) expect(SURVEY_RESPONSES[code]).toBeLessThanOrEqual(STRATA_POPULATION[code]);
  });

  it("12 lokasi dan 40 proyek bernama unik", () => {
    const projects = demoProjects(createRandom(1));
    expect(LOCATIONS).toHaveLength(12);
    expect(projects).toHaveLength(40);
    expect(new Set(projects.map((p) => p.name)).size).toBe(40);
    expect(projects.every((p) => p.locationIndex >= 1 && p.locationIndex < 12)).toBe(true);
  });

  it("alokasi berbobot selalu berjumlah tepat", () => {
    const rng = createRandom(7);
    for (const count of [0, 1, 37, 100, 300, 765, 1800]) {
      const weights = Array.from({ length: 40 }, () => rng.uniform(0.5, 1.5));
      const parts = allocateByWeight(weights, count);
      expect(parts.reduce((s, n) => s + n, 0)).toBe(count);
      expect(parts.every((n) => n >= 0)).toBe(true);
    }
  });

  it("pengambilan berbobot tanpa pengembalian", () => {
    const picked = weightedSample(createRandom(3), Array.from({ length: 50 }, (_, i) => i), () => 1, 20);
    expect(new Set(picked).size).toBe(20);
  });
});

describe("model jawaban", () => {
  const rng = createRandom(42);
  const effects = fixedEffects(rng, instrument.characteristics.map((c) => c.code), ["D1", "D2", "D3", "D4", "D5", "D6", "D7"]);
  const responses = Array.from({ length: 600 }, (_, i) => generateResponse(rng, instrument, { unitMean: 3, stratum: i % 2 ? "S4" : "S2" }, effects));

  it("setiap jawaban lengkap dan bernilai sah", () => {
    for (const r of responses) {
      expect(r.characteristics).toHaveLength(18);
      expect(r.climate).toHaveLength(21);
      expect(r.climate.every((c) => Number.isInteger(c.value) && c.value >= 1 && c.value <= 5)).toBe(true);
      expect(r.durationSeconds).toBeGreaterThan(0);
    }
  });

  it("persepsi manajemen lebih tinggi daripada pelaksana", () => {
    const mean = (stratumOdd: boolean) => {
      const levels = responses
        .filter((_, i) => Boolean(i % 2) === stratumOdd)
        .flatMap((r) => r.characteristics.map((c) => (c.statementId ? Number(c.statementId.slice(-1)) : null)))
        .filter((v): v is number => v !== null);
      return levels.reduce((s, v) => s + v, 0) / levels.length;
    };
    expect(mean(false) - mean(true)).toBeGreaterThan(0.2);
  });

  it("memuat sebagian kecil jawaban terlalu cepat", () => {
    const fast = responses.filter((r) => r.durationSeconds < 240).length / responses.length;
    expect(fast).toBeGreaterThan(0.005);
    expect(fast).toBeLessThan(0.06);
  });
});

describe("berkas dan waktu", () => {
  it("PDF contoh diawali penanda PDF dan memiliki xref yang benar", () => {
    const text = new TextDecoder().decode(samplePdf("Kebijakan K3 (contoh)", ["Baris satu"]));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    const xref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const firstObject = Number(text.match(/0000000000 65535 f \n(\d{10})/)![1]);
    expect(text.slice(firstObject, firstObject + 7)).toBe("1 0 obj");
    expect(text).toContain("Kebijakan K3 \\(contoh\\)");
  });

  it("waktu kerja berada di rentang dan pada jam kerja WIB", () => {
    const rng = createRandom(9);
    const from = new Date("2026-09-01T00:00:00Z");
    const to = new Date("2026-09-30T00:00:00Z");
    for (let i = 0; i < 200; i++) {
      const at = workingTime(rng, from, to);
      expect(at >= from && at <= to).toBe(true);
      const hour = Number(wibLocal(at).slice(11, 13));
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThanOrEqual(17);
    }
  });
});
