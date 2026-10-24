// guard-exempt: self-assessment-token. Lihat /sa/[token]/answer/route.ts.

import { z } from "zod";
import { getRequestMeta } from "@/lib/request-meta";
import { submitSelfAssessment } from "@/lib/self-assessment/service";
import { toResponse } from "../token-route";

const paramsSchema = z.object({ token: z.string().min(1).max(64) });

/** Mengirim penilaian mandiri; jawaban terkunci setelahnya. 422 berisi daftar karakteristik yang belum lengkap. */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_TOKEN" }, { status: 404 });
  return toResponse(await submitSelfAssessment(parsed.data.token, await getRequestMeta()));
}
