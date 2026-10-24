import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { exportAuditTrail, type AuditCsvLabels } from "@/lib/audit-trail/service";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { AUDIT_ROLES } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { getRequestMeta } from "@/lib/request-meta";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

/** Ekspor jejak audit asesmen ke CSV untuk lead assessor (docs/04 bagian 6). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, AUDIT_ROLES.export);
    const t = await getTranslations("auditTrail");
    const { csv } = await exportAuditTrail(
      { ...access, actorId: access.session.user.id },
      t.raw("csv") as AuditCsvLabels,
      getAppTimeZone(),
      t("system"),
      await getRequestMeta(),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jejak-audit-${access.assessmentId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
