// guard-exempt: self-assessment-token. Pengisi penilaian mandiri tidak memiliki akun; hak aksesnya adalah token
// acak 32 byte yang hanya disimpan hash-nya. Penilaian mandiri teridentifikasi, sehingga perubahan dicatat di
// jejak audit beserta metadata permintaan (docs/01 M4, docs/02 bagian 4 paragraf terakhir).

import { z } from "zod";
import { getRequestMeta } from "@/lib/request-meta";
import { answerDraftSchema } from "@/lib/self-assessment/rules";
import { saveSelfAssessmentAnswer } from "@/lib/self-assessment/service";
import { invalidInput, readJson, toResponse } from "../token-route";

const paramsSchema = z.object({ token: z.string().min(1).max(64) });

/** Menyimpan draf satu karakteristik. */
export async function PUT(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  const body = answerDraftSchema.safeParse(await readJson(request));
  if (!parsed.success || !body.success) return invalidInput();
  return toResponse(await saveSelfAssessmentAnswer(parsed.data.token, body.data, await getRequestMeta()));
}
