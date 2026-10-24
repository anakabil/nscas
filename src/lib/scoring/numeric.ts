// Toleransi dan pembulatan sesuai docs/03 bagian 1.

/** Toleransi perbandingan ambang. Contoh: selisih >= 1,00 - EPS. */
export const EPS = 1e-9;

/** Pembulatan ke atas setara ROUNDUP Excel, kebal galat floating point (misalnya 0,07 x 100 = 7,000000000000001). */
export function ceilSafe(x: number): number {
  return Math.ceil(x - EPS);
}

export function mean(values: readonly number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Varians sampel dengan pembagi n - 1. */
export function sampleVariance(values: readonly number[]): number {
  const m = mean(values);
  let sum = 0;
  for (const v of values) sum += (v - m) ** 2;
  return sum / (values.length - 1);
}
