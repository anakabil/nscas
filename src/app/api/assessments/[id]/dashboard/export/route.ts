import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { DASHBOARD_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { buildDashboardWorkbook, type ExportLabels } from "@/lib/dashboard/export";
import { loadDashboard } from "@/lib/dashboard/service";
import { getRequestMeta } from "@/lib/request-meta";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

/** Ekspor Excel dasbor dari model yang sama dengan halaman; sel di bawah 5 responden sudah disembunyikan. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, DASHBOARD_ROLES.export);
    const model = await loadDashboard(access.assessmentId, { roles: access.roles, unitScope: access.unitScope });
    if (!model.available) return Response.json({ error: model.reason }, { status: 409 });
    const db = getDb();
    const assessment = await db.assessment.findUniqueOrThrow({ where: { id: access.assessmentId }, select: { name: true, organization: { select: { name: true } } } });
    const t = await getTranslations("dashboard");
    const bytes = await buildDashboardWorkbook(model, t.raw("exportLabels") as ExportLabels, { assessmentName: assessment.name, organizationName: assessment.organization.name });
    const meta = await getRequestMeta();
    await db.$transaction((tx) =>
      logAudit(tx, {
        action: "dashboard.export",
        entityType: "ScoreRun",
        entityId: model.run.id,
        actor: { id: access.session.user.id, role: access.roles[0] ?? null },
        organizationId: access.organizationId,
        assessmentId: access.assessmentId,
        after: { isFinal: model.run.isFinal, audience: model.audience },
        meta,
      }),
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dasbor-asesmen.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
