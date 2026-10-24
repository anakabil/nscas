import { describe, expect, it } from "vitest";
import { durationBucket, estimatedMedianMinutes, NOMINAL_DURATION_MINUTES, respondentOrder, surveySubmissionSchema, wibDateOnly } from "../rules";

describe("rentang durasi", () => {
  it.each([
    [0, "UNDER_5"],
    [299, "UNDER_5"],
    [300, "FROM_5_TO_10"],
    [599, "FROM_5_TO_10"],
    [600, "FROM_10_TO_15"],
    [900, "FROM_15_TO_20"],
    [1199, "FROM_15_TO_20"],
    [1200, "OVER_20"],
    [86_400, "OVER_20"],
  ] as const)("%i detik menjadi %s", (seconds, bucket) => {
    expect(durationBucket(seconds)).toBe(bucket);
  });
});

describe("taksiran median durasi asesmen", () => {
  it("memakai durasi nominal 15 menit sebelum ada 10 jawaban", () => {
    expect(estimatedMedianMinutes({})).toBe(NOMINAL_DURATION_MINUTES);
    expect(estimatedMedianMinutes({ UNDER_5: 9 })).toBe(15);
  });

  it("mengambil titik tengah rentang median", () => {
    expect(estimatedMedianMinutes({ UNDER_5: 2, FROM_5_TO_10: 3, FROM_10_TO_15: 6 })).toBe(12.5);
    expect(estimatedMedianMinutes({ FROM_15_TO_20: 4, OVER_20: 7 })).toBe(25);
  });

  it("jumlah genap yang terbelah di batas rentang memakai rata-rata dua titik tengah", () => {
    expect(estimatedMedianMinutes({ FROM_5_TO_10: 5, FROM_10_TO_15: 0, FROM_15_TO_20: 5 })).toBe(12.5);
  });
});

describe("tanggal kirim", () => {
  it("hanya tanggal kalender WIB, tanpa jam", () => {
    expect(wibDateOnly(new Date("2026-11-02T16:59:59Z")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(wibDateOnly(new Date("2026-11-02T17:00:00Z")).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });
});

describe("urutan pernyataan per responden", () => {
  const statements = ["s1", "s2", "s3", "s4", "s5"].map((id) => ({ id }));

  it("tetap untuk benih yang sama dan memuat seluruh butir", () => {
    const a = respondentOrder(statements, "token-a");
    expect(respondentOrder(statements, "token-a")).toEqual(a);
    expect([...a].map((s) => s.id).sort()).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("berbeda antarresponden dan setiap pernyataan sama mungkinnya tampil pertama", () => {
    const firsts = new Map<string, number>();
    const orders = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const order = respondentOrder(statements, `token-${i}`);
      orders.add(order.map((s) => s.id).join(""));
      firsts.set(order[0]!.id, (firsts.get(order[0]!.id) ?? 0) + 1);
    }
    expect(orders.size).toBeGreaterThan(100);
    for (const count of firsts.values()) expect(count / 2000).toBeGreaterThan(0.15);
    for (const count of firsts.values()) expect(count / 2000).toBeLessThan(0.25);
  });
});

describe("validasi kiriman", () => {
  const valid = {
    language: "id",
    stratumId: null,
    durationSeconds: 600,
    characteristics: [{ characteristicId: "c1", statementId: "s1" }, { characteristicId: "c2", statementId: null }],
    climate: [{ itemId: "i1", value: 4 }],
  };

  it("menerima kiriman sah, termasuk Tidak tahu sebagai null", () => {
    expect(surveySubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak nilai skala di luar 1 sampai 5, bahasa lain, dan durasi negatif", () => {
    expect(surveySubmissionSchema.safeParse({ ...valid, climate: [{ itemId: "i1", value: 6 }] }).success).toBe(false);
    expect(surveySubmissionSchema.safeParse({ ...valid, language: "fr" }).success).toBe(false);
    expect(surveySubmissionSchema.safeParse({ ...valid, durationSeconds: -1 }).success).toBe(false);
  });

  it("tidak menerima tingkat pernyataan dari peramban", () => {
    const parsed = surveySubmissionSchema.parse({ ...valid, characteristics: [{ characteristicId: "c1", statementId: "s1", level: 5 }] });
    expect(parsed.characteristics[0]).toEqual({ characteristicId: "c1", statementId: "s1" });
  });
});
