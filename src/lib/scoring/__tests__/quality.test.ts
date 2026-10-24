// Tes statistik mutu data (docs/03 bagian 8) dengan nilai yang dihitung tangan.

import { describe, expect, it } from "vitest";
import kasusTepi from "../../../../seed/fixtures/kasus-tepi.json";
import seedParameters from "../../../../seed/aspek-dan-parameter.json";
import {
  cronbachAlpha,
  expectedUniformVariance,
  median,
  responseQualityFlags,
  reverseScore,
  rwgJ,
  rwgSingle,
} from "../quality";

const thresholds = {
  straightliningShare: seedParameters.quality.straightliningShare, // 0,90
  speedingFractionOfMedian: seedParameters.quality.speedingFractionOfMedian, // 0,33
  dontKnowShareMax: seedParameters.quality.dontKnowShareMax, // 0,50
};

describe("rwg(J), banyak butir", () => {
  it("empat responden, tiga butir: 0,96", () => {
    // Baris = responden, kolom = butir.
    //   butir 1: 4, 4, 5, 5  rata-rata 4,5; jumlah kuadrat simpangan 4 x 0,25 = 1; s^2 = 1/3
    //   butir 2: 3, 4, 3, 4  rata-rata 3,5; jumlah kuadrat simpangan 1;          s^2 = 1/3
    //   butir 3: 4, 4, 4, 4  s^2 = 0
    // rataS^2 = (1/3 + 1/3 + 0) / 3 = 2/9; sigmaEU^2 = (25 - 1) / 12 = 2
    // r = (2/9) / 2 = 1/9; J(1 - r) = 3 x 8/9 = 8/3
    // rwg(J) = (8/3) / (8/3 + 1/9) = (24/9) / (25/9) = 24/25 = 0,96
    const matrix = [
      [4, 3, 4],
      [4, 4, 4],
      [5, 3, 4],
      [5, 4, 4],
    ];
    expect(rwgJ(matrix)).toBeCloseTo(0.96, 12);
  });

  it("satu butir (J = 1) sama dengan rwg satu butir", () => {
    // Untuk J = 1: rwg(J) = (1 - r) / ((1 - r) + r) = 1 - r, yaitu rumus rwg satu butir.
    const values = kasusTepi.rwgSatuButir.input.values;
    expect(rwgJ(values.map((v) => [v]))).toBeCloseTo(rwgSingle(values) as number, 12);
    expect(rwgJ(values.map((v) => [v]))).toBeCloseTo(kasusTepi.rwgSatuButir.expected, 6);
  });

  it("varians teramati melebihi varians seragam dijadikan 0", () => {
    // Butir 1 dan 2: 1, 5, 1, 5; rata-rata 3; jumlah kuadrat simpangan 4 x 4 = 16; s^2 = 16/3
    // r = (16/3) / 2 = 2,67 > 1, sehingga kesepakatan dianggap tidak ada: 0
    expect(
      rwgJ([
        [1, 1],
        [5, 5],
        [1, 1],
        [5, 5],
      ]),
    ).toBe(0);
  });

  it("kesepakatan sempurna menghasilkan 1", () => {
    // Semua varians butir 0: r = 0; rwg(J) = J / J = 1
    expect(
      rwgJ([
        [3, 4],
        [3, 4],
        [3, 4],
      ]),
    ).toBe(1);
  });

  it("null bila kurang dari dua responden atau tanpa butir", () => {
    expect(rwgJ([[3, 4]])).toBeNull();
    expect(rwgJ([[], []])).toBeNull();
    expect(rwgSingle([4])).toBeNull();
  });

  it("varians seragam skala lima titik adalah 2,0", () => {
    expect(expectedUniformVariance()).toBe(2);
    expect(expectedUniformVariance(7)).toBe(4); // (49 - 1) / 12
  });
});

describe("alfa Cronbach dengan pembalikan butir negatif", () => {
  it("butir negatif dibalik dengan 6 - nilai", () => {
    expect(reverseScore(1)).toBe(5);
    expect(reverseScore(2)).toBe(4);
    expect(reverseScore(3)).toBe(3);
  });

  it("matriks dengan butir ketiga disimpan terbalik memberi alfa yang sama dengan fixture", () => {
    // Fixture alphaCronbach memakai skor yang sudah dibalik. Di sini butir ketiga disimpan sebagai
    // jawaban asli (6 - skor) lalu ditandai reverseCoded; hasilnya harus kembali 0,881579.
    const scored = kasusTepi.alphaCronbach.input.matrix;
    const raw = scored.map(([a, b, c]) => [a, b, 6 - c]);
    expect(cronbachAlpha(raw, { reverseCoded: [false, false, true] })).toBeCloseTo(
      kasusTepi.alphaCronbach.expected,
      6,
    );
    // Tanpa pembalikan, butir ketiga berkorelasi negatif dan alfa turun jauh.
    expect(cronbachAlpha(raw) as number).toBeLessThan(0.5);
  });

  it("dua butir, tiga responden: 12/13 = 0,923077", () => {
    // Butir 1: 1, 2, 3 (s^2 = 1); butir 2: 2, 2, 4 (rata-rata 8/3; s^2 = (4/9 + 4/9 + 16/9) / 2 = 4/3)
    // Total: 3, 4, 7 (rata-rata 14/3; s^2 = (25/9 + 4/9 + 49/9) / 2 = 13/3)
    // alfa = (2/1) x (1 - (1 + 4/3) / (13/3)) = 2 x (1 - 7/13) = 12/13 = 0,923077
    expect(
      cronbachAlpha([
        [1, 2],
        [2, 2],
        [3, 4],
      ]),
    ).toBeCloseTo(12 / 13, 12);
  });

  it("null bila kurang dari dua butir, kurang dari dua responden, atau varians total nol", () => {
    expect(cronbachAlpha([[3], [4]])).toBeNull();
    expect(cronbachAlpha([[3, 4]])).toBeNull();
    expect(
      cronbachAlpha([
        [3, 3],
        [3, 3],
      ]),
    ).toBeNull();
  });
});

describe("median", () => {
  it("ganjil, genap, dan kosong", () => {
    expect(median([9, 3, 5])).toBe(5);
    expect(median([12, 8, 10, 20])).toBe(11); // (10 + 12) / 2
    expect(median([])).toBeNull();
  });
});

describe("tanda mutu jawaban", () => {
  const base = {
    climateValues: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
    characteristicLevels: [3, 3, 4, 2, 3],
    durationMinutes: 12,
  };

  it("jawaban wajar tidak ditandai", () => {
    expect(responseQualityFlags(base, 12, thresholds)).toEqual([]);
  });

  it("POLA_SERAGAM bila 90 persen atau lebih jawaban iklim bernilai sama", () => {
    // 19 dari 21 butir bernilai 4: 19/21 = 0,9048 >= 0,90, ditandai.
    const nineteen = [...Array(19).fill(4), 3, 3];
    expect(responseQualityFlags({ ...base, climateValues: nineteen }, 12, thresholds)).toEqual(["POLA_SERAGAM"]);
    // Tepat 9 dari 10: 0,90 >= 0,90, ditandai (batas inklusif).
    const nine = [...Array(9).fill(5), 1];
    expect(responseQualityFlags({ ...base, climateValues: nine }, 12, thresholds)).toEqual(["POLA_SERAGAM"]);
    // 18 dari 21: 0,857 < 0,90, tidak ditandai.
    const eighteen = [...Array(18).fill(4), 3, 3, 3];
    expect(responseQualityFlags({ ...base, climateValues: eighteen }, 12, thresholds)).toEqual([]);
  });

  it("TERLALU_CEPAT bila durasi kurang dari 0,33 x median", () => {
    // Median 12 menit: 0,33 x 12 = 3,96 menit.
    expect(responseQualityFlags({ ...base, durationMinutes: 3.9 }, 12, thresholds)).toEqual(["TERLALU_CEPAT"]);
    // Tepat 3,96 bukan "kurang dari", tidak ditandai.
    expect(responseQualityFlags({ ...base, durationMinutes: 3.96 }, 12, thresholds)).toEqual([]);
    expect(responseQualityFlags({ ...base, durationMinutes: 4 }, 12, thresholds)).toEqual([]);
    // Tanpa median atau durasi, tanda ini tidak dapat dinilai.
    expect(responseQualityFlags({ ...base, durationMinutes: 1 }, null, thresholds)).toEqual([]);
    expect(responseQualityFlags({ ...base, durationMinutes: null }, 12, thresholds)).toEqual([]);
  });

  it("BANYAK_TIDAK_TAHU bila lebih dari 50 persen jawaban karakteristik Tidak tahu", () => {
    // 18 karakteristik, 9 Tidak tahu: 9/18 = 0,50, bukan "lebih dari", tidak ditandai.
    const nineOf18 = [...Array(9).fill(null), ...Array(9).fill(3)];
    expect(responseQualityFlags({ ...base, characteristicLevels: nineOf18 }, 12, thresholds)).toEqual([]);
    // 10 dari 18: 0,556 > 0,50, ditandai.
    const tenOf18 = [...Array(10).fill(null), ...Array(8).fill(3)];
    expect(responseQualityFlags({ ...base, characteristicLevels: tenOf18 }, 12, thresholds)).toEqual([
      "BANYAK_TIDAK_TAHU",
    ]);
  });

  it("ketiga tanda dapat muncul bersamaan", () => {
    const flags = responseQualityFlags(
      { climateValues: Array(21).fill(3), characteristicLevels: Array(18).fill(null), durationMinutes: 2 },
      12,
      thresholds,
    );
    expect(flags).toEqual(["POLA_SERAGAM", "TERLALU_CEPAT", "BANYAK_TIDAK_TAHU"]);
  });

  it("tanpa jawaban iklim atau karakteristik tidak ditandai", () => {
    expect(
      responseQualityFlags({ climateValues: [], characteristicLevels: [], durationMinutes: 12 }, 12, thresholds),
    ).toEqual([]);
  });
});
