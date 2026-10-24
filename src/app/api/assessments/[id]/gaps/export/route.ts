import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { buildActionPlanWorkbook, type PlanExportLabels } from "@/lib/action-plan/export";
import { loadActionPlan } from "@/lib/action-plan/service";
import { logAudit } from "@/lib/audit";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { ACTION_PLAN_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import type { EngineParameters } from "@/lib/scoring";
import { aspectWeights } from "@/lib/scoring";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

/** Ekspor Excel daftar kesenjangan dan rencana aksi; koordinator unit hanya memperoleh tindakan unitnya. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, ACTION_PLAN_ROLES.read);
    const plan = await loadActionPlan(access.assessmentId, access.unitScope);
    if (!plan.hasFinalResult) return Response.json({ error: "RESULT_NOT_FINAL" }, { status: 409 });
    const db = getDb();
    const run = await db.scoreRun.findFirst({ where: { assessmentId: access.assessmentId, isFinal: true }, select: { parameterSnapshot: true } });
    const engine = (run?.parameterSnapshot as { engine?: EngineParameters } | null)?.engine;
    const weights = engine ? Object.fromEntries(aspectWeights(engine)) : {};
    const t = await getTranslations("gaps");
    const labels: PlanExportLabels = {
      sheets: t.raw("exportLabels.sheets") as PlanExportLabels["sheets"],
      columns: t.raw("exportLabels.columns") as Record<string, string>,
      statuses: t.raw("statuses") as Record<string, string>,
      priorities: t.raw("priorities") as Record<string, string>,
      due: t.raw("due") as Record<string, string>,
      noUnit: t("fields.noUnit"),
    };
    const bytes = await buildActionPlanWorkbook(plan, labels, weights);
    const meta = await getRequestMeta();
    await db.$transaction((tx) =>
      logAudit(tx, {
        action: "action_plan.export",
        entityType: "Assessment",
        entityId: access.assessmentId,
        actor: { id: access.session.user.id, role: access.roles[0] ?? null },
        organizationId: access.organizationId,
        assessmentId: access.assessmentId,
        after: { gapItems: plan.gaps.length, actions: plan.gaps.reduce((n, g) => n + g.actions.length, 0) },
        meta,
      }),
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rencana-aksi.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
