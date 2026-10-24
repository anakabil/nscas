// guard-exempt: self-assessment-token. Lihat /sa/[token]/answer/route.ts.

import { z } from "zod";
import { getRequestMeta } from "@/lib/request-meta";
import { profileSchema } from "@/lib/self-assessment/rules";
import { saveSelfAssessmentProfile } from "@/lib/self-assessment/service";
import { invalidInput, readJson, toResponse } from "../token-route";

const paramsSchema = z.object({ token: z.string().min(1).max(64) });

/** Nama dan jabatan pengisi; dapat dikoreksi pengisi selama masih draf. */
export async function PUT(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  const body = profileSchema.safeParse(await readJson(request));
  if (!parsed.success || !body.success) return invalidInput();
  return toResponse(await saveSelfAssessmentProfile(parsed.data.token, body.data, await getRequestMeta()));
}
