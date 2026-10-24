// Aturan murni survei responden (docs/01 M3, docs/02 bagian 4, docs/03 bagian 8). Tanpa I/O, sehingga dapat
// dipakai di server dan diuji tanpa basis data.

import { createHash } from "node:crypto";
import { z } from "zod";

export const DURATION_BUCKETS = ["UNDER_5", "FROM_5_TO_10", "FROM_10_TO_15", "FROM_15_TO_20", "OVER_20"] as const;
export type DurationBucketCode = (typeof DURATION_BUCKETS)[number];

/** Durasi hanya disimpan sebagai rentang lima menit agar tidak dapat dicocokkan dengan waktu token. */
export function durationBucket(seconds: number): DurationBucketCode {
  const minutes = seconds / 60;
  if (minutes < 5) return "UNDER_5";
  if (minutes < 10) return "FROM_5_TO_10";
  if (minutes < 15) return "FROM_10_TO_15";
  if (minutes < 20) return "FROM_15_TO_20";
  return "OVER_20";
}

/** Titik tengah rentang (menit), dipakai untuk menaksir median durasi asesmen. Rentang terbuka di atas 20 dianggap 25. */
export const BUCKET_MIDPOINT_MINUTES: Record<DurationBucketCode, number> = {
  UNDER_5: 2.5,
  FROM_5_TO_10: 7.5,
  FROM_10_TO_15: 12.5,
  FROM_15_TO_20: 17.5,
  OVER_20: 25,
};

/** Perkiraan durasi pengisian yang disampaikan kepada responden (surel dan lembar kode QR). */
export const NOMINAL_DURATION_MINUTES = 15;
/** Median dari rentang baru dipakai setelah cukup banyak jawaban; sebelumnya memakai durasi nominal. */
export const MIN_RESPONSES_FOR_MEDIAN = 10;

/**
 * Median durasi asesmen untuk tanda TERLALU_CEPAT. Durasi tepat tidak pernah disimpan, sehingga median
 * ditaksir dari titik tengah rentang jawaban yang sudah masuk.
 */
export function estimatedMedianMinutes(counts: Partial<Record<DurationBucketCode, number>>): number {
  const total = DURATION_BUCKETS.reduce((s, b) => s + (counts[b] ?? 0), 0);
  if (total < MIN_RESPONSES_FOR_MEDIAN) return NOMINAL_DURATION_MINUTES;
  const half = total / 2;
  let seen = 0;
  for (const b of DURATION_BUCKETS) {
    const n = counts[b] ?? 0;
    // Jumlah genap yang tepat terbelah di batas rentang: rata-rata dua titik tengah.
    if (seen + n === half && n > 0) {
      const next = DURATION_BUCKETS.slice(DURATION_BUCKETS.indexOf(b) + 1).find((x) => (counts[x] ?? 0) > 0);
      return next ? (BUCKET_MIDPOINT_MINUTES[b] + BUCKET_MIDPOINT_MINUTES[next]) / 2 : BUCKET_MIDPOINT_MINUTES[b];
    }
    if (seen + n > half) return BUCKET_MIDPOINT_MINUTES[b];
    seen += n;
  }
  return NOMINAL_DURATION_MINUTES;
}

/** Tanggal kalender WIB (UTC+7) tanpa jam, untuk SurveyResponse.submittedOn. */
export function wibDateOnly(now: Date): Date {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/**
 * Urutan acak yang tetap untuk satu responden: butir diurutkan menurut SHA-256 dari benih (hash token) dan
 * id butir. Urutan yang sama muncul setiap kali tautan dibuka, tetapi berbeda antarresponden.
 */
export function respondentOrder<T extends { id: string }>(items: readonly T[], seed: string): T[] {
  const key = (id: string) => createHash("sha256").update(`${seed}:${id}`).digest("hex");
  return items
    .map((item) => ({ item, key: key(item.id) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((x) => x.item);
}

const id = z.string().min(1).max(64);

/** Isi kiriman survei dari peramban. Pernyataan dikirim sebagai id pilihan; tingkatnya hanya diketahui server. */
export const surveySubmissionSchema = z.object({
  language: z.enum(["id", "en"]),
  /** Wajib untuk token dari kode QR (strata dipilih responden); diabaikan untuk token daftar responden. */
  stratumId: id.nullish(),
  /** Durasi dari persetujuan sampai menekan Kirim, dalam detik. Hanya dipakai untuk rentang dan tanda mutu. */
  durationSeconds: z.number().int().min(0).max(30 * 24 * 60 * 60),
  characteristics: z
    .array(z.object({ characteristicId: id, statementId: id.nullable() }))
    .min(1)
    .max(200),
  climate: z
    .array(z.object({ itemId: id, value: z.number().int().min(1).max(5) }))
    .min(1)
    .max(500),
});

export type SurveySubmission = z.infer<typeof surveySubmissionSchema>;
