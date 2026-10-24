import { z } from "zod";
import { accessErrorResponse, requireRole, unitWhere } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });
const querySchema = z.object({ unitId: z.string().min(1).max(64).optional() });

/**
 * Daftar responden (docs/04: LEAD_ASSESSOR baca, CLIENT_ADMIN ubah, UNIT_COORDINATOR unitnya;
 * SUPER_ADMIN, ASSESSOR, dan EXECUTIVE_VIEWER tidak berhak). Kolom kontak terenkripsi tidak dikembalikan.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsedParams.success || !parsedQuery.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsedParams.data.id, rolesFor("roster", "read"), { unitId: parsedQuery.data.unitId });
    const respondents = await getDb().rosterEntry.findMany({
      where: {
        assessmentId: access.assessmentId,
        ...unitWhere(access),
        ...(parsedQuery.data.unitId ? { unitId: parsedQuery.data.unitId } : {}),
      },
      select: { id: true, fullName: true, employeeNo: true, unitId: true, stratumId: true, isContractor: true },
      orderBy: { fullName: "asc" },
    });
    return Response.json({ respondents });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
