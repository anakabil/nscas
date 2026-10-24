import { z } from "zod";
import { assessmentErrorResponse } from "@/lib/assessments/action-errors";
import { CONFIGURATION_WRITE_ROLES } from "@/lib/assessments/permissions";
import { stratumSchema, updateStratum } from "@/lib/assessments/service";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";

const paramsSchema = z.object({ id: z.string().min(1).max(64), stratumId: z.string().min(1).max(64) });

/** Mengubah strata. Ditolak dengan 409 bila asesmen sudah dikunci (CLAUDE.md aturan 5). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; stratumId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const actor = await requireRole(parsedParams.data.id, CONFIGURATION_WRITE_ROLES);
    const body = stratumSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
    await updateStratum(actor, parsedParams.data.stratumId, body.data, await getRequestMeta());
    return Response.json({ ok: true });
  } catch (error) {
    return assessmentErrorResponse(error) ?? accessErrorResponse(error);
  }
}
