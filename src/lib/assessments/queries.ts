import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/**
 * Asesmen yang dapat dilihat pengguna di daftar: seluruhnya untuk SUPER_ADMIN, yang ditugaskan untuk
 * asesor, milik organisasinya untuk peran klien, dan yang memuat unitnya untuk koordinator unit.
 * Membuka rinciannya tetap melalui requireRole.
 */
export function visibleAssessmentsWhere(session: SessionContext): Prisma.AssessmentWhereInput {
  const { principal } = session;
  if (principal.isSuperAdmin) return {};

  const or: Prisma.AssessmentWhereInput[] = [];
  const isStaff = principal.memberships.some(
    (m) => m.organizationIsOperator && (m.role === "LEAD_ASSESSOR" || m.role === "ASSESSOR"),
  );
  if (isStaff) or.push({ assignments: { some: { userId: principal.userId } } });

  for (const m of principal.memberships) {
    if (m.organizationIsOperator) continue;
    if (m.role === "UNIT_COORDINATOR") {
      or.push({ organizationId: m.organizationId, units: { some: { id: { in: m.unitScope } } } });
    } else {
      or.push({ organizationId: m.organizationId });
    }
  }
  return or.length > 0 ? { OR: or } : { id: { in: [] } };
}

export async function listVisibleAssessments(session: SessionContext) {
  return getDb().assessment.findMany({
    where: visibleAssessmentsWhere(session),
    select: {
      id: true,
      name: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      organization: { select: { name: true } },
    },
    orderBy: [{ periodStart: "desc" }, { name: "asc" }],
  });
}
