import { z } from "zod";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { ALL_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

/** Ringkasan asesmen untuk semua peran yang berhubungan dengan asesmen ini. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, ALL_ROLES);
    const assessment = await getDb().assessment.findUniqueOrThrow({
      where: { id: access.assessmentId, organizationId: access.organizationId },
      select: { id: true, name: true, status: true, targetLevel: true, organizationId: true },
    });
    return Response.json({ assessment, roles: access.roles, unitScope: access.unitScope });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
