// Aturan murni penilaian mandiri (docs/01 M4). Penilaian mandiri teridentifikasi: setiap jawaban wajib
// beralasan agar asesor dapat menelusurinya, sehingga alasan pendek atau kosong tidak dapat dikirim.

import { z } from "zod";

export const JUSTIFICATION_MIN_LENGTH = 50;
export const JUSTIFICATION_MAX_LENGTH = 4000;

const id = z.string().min(1).max(64);

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(200),
  position: z.string().trim().min(2).max(200),
});

/** Penyimpanan draf satu karakteristik. Alasan boleh belum lengkap selama masih draf. */
export const answerDraftSchema = z.object({
  characteristicId: id,
  statementId: id.nullable(),
  justification: z.string().max(JUSTIFICATION_MAX_LENGTH),
  evidenceIds: z.array(id).max(50).transform((ids) => [...new Set(ids)]),
});

export type AnswerDraft = z.output<typeof answerDraftSchema>;

export const issueSchema = z.object({
  name: z.string().trim().min(2).max(200),
  position: z.string().trim().min(2).max(200),
  unitId: id,
});

/** Panjang alasan dihitung tanpa spasi berlebih di awal, akhir, dan di antara kata. */
export function justificationLength(text: string | null | undefined): number {
  return (text ?? "").trim().replace(/\s+/g, " ").length;
}

export type MissingReason = "LEVEL" | "JUSTIFICATION";

/** Karakteristik yang belum memenuhi syarat kirim: belum memilih pernyataan atau alasan kurang dari 50 karakter. */
export function missingForSubmit(
  characteristicIds: readonly string[],
  answers: readonly { characteristicId: string; level: number | null; justification: string | null }[],
): { characteristicId: string; reasons: MissingReason[] }[] {
  const byId = new Map(answers.map((a) => [a.characteristicId, a]));
  return characteristicIds.flatMap((characteristicId) => {
    const a = byId.get(characteristicId);
    const reasons: MissingReason[] = [];
    if (!a || a.level === null) reasons.push("LEVEL");
    if (justificationLength(a?.justification) < JUSTIFICATION_MIN_LENGTH) reasons.push("JUSTIFICATION");
    return reasons.length > 0 ? [{ characteristicId, reasons }] : [];
  });
}
