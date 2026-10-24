import { z } from "zod";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";

const paramsSchema = z.object({ id: z.string().min(1).max(64), unitId: z.string().min(1).max(64) });

/** Rincian unit dan partisipasinya (docs/04: token dan partisipasi; koordinator hanya unitnya). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; unitId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, rolesFor("tokensAndParticipation", "read"), {
      unitId: parsed.data.unitId,
    });
    const db = getDb();
    const unit = await db.unit.findUniqueOrThrow({
      where: { id: parsed.data.unitId, assessmentId: access.assessmentId },
      select: { id: true, name: true, type: true },
    });
    const [issued, completed] = await Promise.all([
      db.accessToken.count({ where: { assessmentId: access.assessmentId, unitId: unit.id, kind: "SURVEY", revokedAt: null } }),
      db.accessToken.count({
        where: { assessmentId: access.assessmentId, unitId: unit.id, kind: "SURVEY", completedAt: { not: null } },
      }),
    ]);
    return Response.json({ unit, participation: { issued, completed } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
