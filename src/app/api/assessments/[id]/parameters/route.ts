import { z } from "zod";
import { assessmentErrorResponse } from "@/lib/assessments/action-errors";
import { loadEffectiveParameters } from "@/lib/assessments/load";
import { editableParametersSchema, editablePart } from "@/lib/assessments/parameters";
import { CONFIGURATION_WRITE_ROLES, configurationReadRoles } from "@/lib/assessments/permissions";
import { updateParameters } from "@/lib/assessments/service";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { ALL_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });
const bodySchema = z.object({
  parameters: editableParametersSchema,
  consentTextId: z.string().max(5_000),
  consentTextEn: z.string().max(5_000),
  dpaSigned: z.boolean(),
});

function errorResponse(error: unknown): Response {
  return assessmentErrorResponse(error) ?? accessErrorResponse(error);
}

/** Parameter yang berlaku (snapshot bila sudah dikunci). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, ALL_ROLES);
    const { status } = await getDb().assessment.findUniqueOrThrow({ where: { id: access.assessmentId }, select: { status: true } });
    await requireRole(parsed.data.id, configurationReadRoles(status));
    const effective = await loadEffectiveParameters(access.assessmentId);
    return Response.json({ status, locked: effective.locked, parameters: editablePart(effective.parameters) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Mengubah parameter. Ditolak dengan 409 bila asesmen sudah dikunci (docs/01 M1). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const actor = await requireRole(parsedParams.data.id, CONFIGURATION_WRITE_ROLES);
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
    await updateParameters(actor, body.data, await getRequestMeta());
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
