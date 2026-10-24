// Aturan penilaian asesor dan rapat panel (docs/01 M8, docs/03 bagian 2.2, 3, dan 5). Murni.

import { z } from "zod";
import { isValidRating } from "@/lib/validation/proposal";

/** Alasan nilai bukti dan penyesuaian panel wajib diisi; batas minimum mencegah alasan kosong seperti "ok". */
export const RATIONALE_MIN_LENGTH = 20;
export const SCL_JUSTIFICATION_MIN_LENGTH = 10;
export const SCL_STEPS = [2, 3, 4, 5] as const;

const id = z.string().min(1).max(64);

export const evidenceRatingSchema = z.object({
  level: z.coerce.number().refine(isValidRating, { message: "INVALID_RATING" }),
  rationale: z.string().trim().min(RATIONALE_MIN_LENGTH).max(4000),
  evidenceIds: z.array(id).max(200).default([]),
  observationIds: z.array(id).max(200).default([]),
});

export const sclAspectSchema = z.object({
  aspectCode: z.string().regex(/^A\d$/),
  entries: z
    .array(
      z.object({
        step: z.coerce.number().int().min(2).max(5),
        percent: z.coerce.number().min(0).max(100),
        justification: z.string().trim().min(SCL_JUSTIFICATION_MIN_LENGTH).max(2000),
      }),
    )
    .length(4)
    .refine((list) => new Set(list.map((e) => e.step)).size === 4, { message: "DUPLICATE_STEP" }),
});

/** Nilai panel 1,00 sampai 5,00 dengan paling banyak dua desimal. */
export function isValidPanelValue(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 5 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export const panelAdjustmentSchema = z.object({
  characteristicCode: z.string().regex(/^K[0-9T]+\.\d+$/),
  adjustedValue: z.coerce.number().refine(isValidPanelValue, { message: "INVALID_PANEL_VALUE" }),
  rationale: z.string().trim().min(RATIONALE_MIN_LENGTH).max(4000),
});

/**
 * Asesor tidak melihat nilai asesor lain sebelum menyimpan nilainya sendiri (docs/01 M8), agar penilaian
 * bukti berdiri sendiri dan tidak terjangkar pada nilai rekan.
 */
export function visibleOtherRatings<T extends { assessorId: string }>(ratings: readonly T[], viewerId: string): { own: T | null; others: T[]; hiddenCount: number } {
  const own = ratings.find((r) => r.assessorId === viewerId) ?? null;
  const others = ratings.filter((r) => r.assessorId !== viewerId);
  return own ? { own, others, hiddenCount: 0 } : { own: null, others: [], hiddenCount: others.length };
}

/** Kode pesan galat dari isian Zod pertama yang gagal, menurut nama kolomnya; selain itu INVALID_INPUT. */
export function issueCode(error: z.ZodError, byField: Record<string, string>): string {
  for (const issue of error.issues) {
    for (const key of issue.path) if (typeof key === "string" && byField[key]) return byField[key];
  }
  return "INVALID_INPUT";
}
