// Analitik dasbor (docs/01 M9, docs/03 bagian 6 dan 8). Murni: menerima respons survei yang tidak dikeluarkan
// dan mengembalikan nilai yang sudah melalui penyembunyian sel (src/lib/privacy/suppression.ts).

import { cronbachAlpha, rwgJ } from "@/lib/scoring";
import { mean } from "@/lib/scoring/numeric";
import { suppressCells, suppressValue, type SafeCell } from "@/lib/privacy/suppression";

export interface DashboardResponse {
  unitId: string;
  stratumId: string;
  /** Kode karakteristik ke tingkat jawaban; null berarti "Tidak tahu". */
  answers: Record<string, number | null>;
  /** Id butir iklim ke nilai 1 sampai 5. */
  climate: Record<string, number>;
}

export interface CharacteristicDef {
  code: string;
  aspectCode: string;
  isContextual: boolean;
}

export interface DimensionDef {
  code: string;
  name: string;
  items: { id: string; reverseCoded: boolean }[];
}

/**
 * Skor survei satu aspek untuk sekelompok respons: rata-rata skor karakteristik non-kontekstualnya, dengan skor
 * karakteristik rata-rata jawaban selain "Tidak tahu". Jumlah responden sel adalah jumlah jawaban paling sedikit
 * di antara karakteristik aspek itu, sejalan dengan kesenjangan persepsi pada mesin penilaian.
 */
export function aspectSurveyScore(responses: readonly DashboardResponse[], characteristics: readonly CharacteristicDef[], aspectCode: string): { value: number | null; n: number } {
  const codes = characteristics.filter((c) => c.aspectCode === aspectCode && !c.isContextual).map((c) => c.code);
  if (codes.length === 0) return { value: null, n: 0 };
  let n = Infinity;
  const scores: number[] = [];
  for (const code of codes) {
    const valid = responses.map((r) => r.answers[code]).filter((a): a is number => typeof a === "number");
    n = Math.min(n, valid.length);
    if (valid.length > 0) scores.push(mean(valid));
  }
  return { value: scores.length === codes.length ? mean(scores) : null, n: Number.isFinite(n) ? n : 0 };
}

export interface HeatmapColumn {
  key: string;
  label: string;
}

export interface Heatmap {
  columns: HeatmapColumn[];
  rows: { aspectCode: string; aspectName: string; cells: SafeCell[] }[];
}

/**
 * Peta warna aspek terhadap kelompok responden (strata atau unit). `groups` berisi kunci kolom yang agregatnya
 * diterbitkan di tempat lain, untuk penyembunyian pelengkap.
 */
export function buildHeatmap(
  responses: readonly DashboardResponse[],
  characteristics: readonly CharacteristicDef[],
  aspects: readonly { code: string; name: string }[],
  columns: readonly (HeatmapColumn & { match: (r: DashboardResponse) => boolean })[],
  min: number,
  groups: readonly (readonly string[])[] = [],
): Heatmap {
  const byColumn = new Map(columns.map((c) => [c.key, responses.filter(c.match)]));
  return {
    columns: columns.map(({ key, label }) => ({ key, label })),
    rows: aspects.map((a) => ({
      aspectCode: a.code,
      aspectName: a.name,
      cells: suppressCells(
        columns.map((c) => ({ key: c.key, ...aspectSurveyScore(byColumn.get(c.key) ?? [], characteristics, a.code) })),
        min,
        groups,
      ),
    })),
  };
}

export type HeatLevel = "good" | "mid" | "low";

/** docs/05: hijau muda untuk 3,3 ke atas, kuning muda untuk 2,8 sampai di bawah 3,3, merah muda di bawah 2,8. */
export function heatLevel(value: number): HeatLevel {
  if (value >= 3.3 - 1e-9) return "good";
  if (value >= 2.8 - 1e-9) return "mid";
  return "low";
}

function dimensionMatrix(responses: readonly DashboardResponse[], dimension: DimensionDef): number[][] {
  return responses.filter((r) => dimension.items.every((i) => typeof r.climate[i.id] === "number")).map((r) => dimension.items.map((i) => r.climate[i.id] as number));
}

/** Alfa Cronbach per dimensi iklim untuk seluruh respons; disembunyikan bila kurang dari min responden lengkap. */
export function cronbachByDimension(responses: readonly DashboardResponse[], dimensions: readonly DimensionDef[], min: number, threshold: number) {
  return dimensions.map((d) => {
    const matrix = dimensionMatrix(responses, d);
    const cell = suppressValue(cronbachAlpha(matrix, { reverseCoded: d.items.map((i) => i.reverseCoded) }), matrix.length, min);
    return { code: d.code, name: d.name, alpha: { ...cell, key: d.code }, belowThreshold: cell.value !== null && cell.value < threshold };
  });
}

/** rwg(J) per unit dan dimensi iklim (James, Demaree, dan Wolf, 1984); unit di bawah min responden disembunyikan. */
export function rwgByUnit(responses: readonly DashboardResponse[], units: readonly { id: string; name: string }[], dimensions: readonly DimensionDef[], min: number, threshold: number) {
  return units
    .map((u) => {
      const own = responses.filter((r) => r.unitId === u.id);
      const perDimension = dimensions.map((d) => {
        const matrix = dimensionMatrix(own, d);
        return { ...suppressValue(rwgJ(matrix), matrix.length, min), key: d.code };
      });
      const visible = perDimension.map((c) => c.value).filter((v): v is number => v !== null);
      const average = visible.length === dimensions.length && visible.length > 0 ? mean(visible) : null;
      return { unitId: u.id, name: u.name, responses: own.length, perDimension, average, belowThreshold: average !== null && average < threshold };
    })
    .filter((u) => u.responses > 0)
    .map(({ responses: count, ...rest }) => ({ ...rest, n: count >= min ? count : null }));
}
