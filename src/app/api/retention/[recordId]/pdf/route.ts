import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { accessErrorResponse, requireRole, requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { destructionRecordForDownload } from "@/lib/retention/service";
import { presignDownload } from "@/lib/storage";

const paramsSchema = z.object({ recordId: z.string().min(1).max(64) });

/**
 * Unduhan berita acara pemusnahan: SUPER_ADMIN, serta lead assessor dan administrator klien asesmen tersebut.
 * Catatan yang tidak ada dan catatan asesmen lain sama-sama dijawab 404 melalui requireRole.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    await requireUser();
    const record = await destructionRecordForDownload(parsed.data.recordId);
    if (!record) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const access = await requireRole(record.assessmentId, ["SUPER_ADMIN", "LEAD_ASSESSOR", "CLIENT_ADMIN"]);
    if (record.pdfStatus !== "READY" || !record.storageKey) return Response.json({ error: "PDF_NOT_READY" }, { status: 409 });
    const url = await presignDownload(record.storageKey, `berita-acara-pemusnahan-${record.id}.pdf`);
    const meta = await getRequestMeta();
    await getDb().$transaction((tx) =>
      logAudit(tx, {
        action: "retention.minutes_download",
        entityType: "DestructionRecord",
        entityId: record.id,
        actor: { id: access.session.user.id, role: access.roles[0] ?? null },
        organizationId: access.organizationId,
        assessmentId: access.assessmentId,
        meta,
      }),
    );
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
