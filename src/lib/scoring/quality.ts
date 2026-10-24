// Statistik mutu data sesuai docs/03 bagian 8.

import { EPS, mean, sampleVariance } from "./numeric";
import type { QualityFlag } from "./types";

/** Varians distribusi seragam yang diharapkan: (A^2 - 1) / 12; 2,0 untuk skala lima titik. */
export function expectedUniformVariance(scalePoints = 5): number {
  return (scalePoints ** 2 - 1) / 12;
}

/**
 * Kesepakatan dalam kelompok satu butir (James, Demaree, dan Wolf, 1984):
 * rwg = 1 - s^2 / sigmaEU^2, nilai negatif dijadikan 0. Null bila kurang dari dua jawaban.
 */
export function rwgSingle(values: readonly number[], scalePoints = 5): number | null {
  if (values.length < 2) return null;
  return Math.max(0, 1 - sampleVariance(values) / expectedUniformVariance(scalePoints));
}

/**
 * rwg(J) untuk J butir dalam satu dimensi. matrix berisi baris responden dan kolom butir.
 * rwg(J) = J(1 - r) / [J(1 - r) + r], dengan r = rataS^2 / sigmaEU^2.
 * Bila rata-rata varians teramati sama dengan atau melebihi varians seragam (r >= 1),
 * nilai dijadikan 0, sejalan dengan perlakuan nilai negatif pada rwg satu butir
 * (LeBreton dan Senter, 2008). Null bila kurang dari dua responden atau tanpa butir.
 */
export function rwgJ(matrix: readonly (readonly number[])[], scalePoints = 5): number | null {
  if (matrix.length < 2 || matrix[0].length === 0) return null;
  const J = matrix[0].length;
  const itemVariances = Array.from({ length: J }, (_, i) => sampleVariance(matrix.map((row) => row[i])));
  const r = mean(itemVariances) / expectedUniformVariance(scalePoints);
  if (r >= 1 - EPS) return 0;
  const agreement = J * (1 - r);
  return agreement / (agreement + r);
}

/** Pembalikan butir negatif: 6 - nilai untuk skala 1 sampai 5. */
export function reverseScore(value: number, scaleMin = 1, scaleMax = 5): number {
  return scaleMin + scaleMax - value;
}

/**
 * Alfa Cronbach per dimensi iklim. matrix berisi baris responden dan kolom butir dengan nilai asli;
 * butir yang ditandai reverseCoded dibalik lebih dulu. Null bila kurang dari dua butir,
 * kurang dari dua responden, atau varians skor total nol.
 */
export function cronbachAlpha(
  matrix: readonly (readonly number[])[],
  options: { reverseCoded?: readonly boolean[]; scaleMin?: number; scaleMax?: number } = {},
): number | null {
  const { reverseCoded = [], scaleMin = 1, scaleMax = 5 } = options;
  if (matrix.length < 2) return null;
  const k = matrix[0].length;
  if (k < 2) return null;

  const scored = matrix.map((row) =>
    row.map((x, i) => (reverseCoded[i] ? reverseScore(x, scaleMin, scaleMax) : x)),
  );
  const itemVariances = Array.from({ length: k }, (_, i) => sampleVariance(scored.map((row) => row[i])));
  const totalVariance = sampleVariance(scored.map((row) => row.reduce((s, x) => s + x, 0)));
  if (totalVariance <= 0) return null;
  const sumItemVariance = itemVariances.reduce((s, x) => s + x, 0);
  return (k / (k - 1)) * (1 - sumItemVariance / totalVariance);
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface QualityThresholds {
  /** POLA_SERAGAM bila porsi nilai terbanyak pada skala iklim >= ambang (bawaan 0,90). */
  straightliningShare: number;
  /** TERLALU_CEPAT bila durasi < pecahan ini x median durasi asesmen (bawaan 0,33). */
  speedingFractionOfMedian: number;
  /** BANYAK_TIDAK_TAHU bila porsi "Tidak tahu" > ambang (bawaan 0,50). */
  dontKnowShareMax: number;
}

export interface ResponseForQuality {
  climateValues: readonly number[];
  /** Jawaban karakteristik; null berarti "Tidak tahu". */
  characteristicLevels: readonly (number | null)[];
  durationMinutes: number | null;
}

/** Tanda mutu jawaban. Ditandai otomatis; pengeluaran dari analisis hanya setelah ditinjau asesor. */
export function responseQualityFlags(
  response: ResponseForQuality,
  medianDurationMinutes: number | null,
  thresholds: QualityThresholds,
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  const climate = response.climateValues;
  if (climate.length > 0) {
    const counts = new Map<number, number>();
    for (const v of climate) counts.set(v, (counts.get(v) ?? 0) + 1);
    const modeShare = Math.max(...counts.values()) / climate.length;
    if (modeShare >= thresholds.straightliningShare - EPS) flags.push("POLA_SERAGAM");
  }

  if (response.durationMinutes !== null && medianDurationMinutes !== null && medianDurationMinutes > 0) {
    if (response.durationMinutes < thresholds.speedingFractionOfMedian * medianDurationMinutes - EPS) {
      flags.push("TERLALU_CEPAT");
    }
  }

  const levels = response.characteristicLevels;
  if (levels.length > 0) {
    const dontKnowShare = levels.filter((l) => l === null).length / levels.length;
    if (dontKnowShare > thresholds.dontKnowShareMax + EPS) flags.push("BANYAK_TIDAK_TAHU");
  }

  return flags;
}
