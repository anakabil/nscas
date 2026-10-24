import { z } from "zod";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { evidenceForDownload } from "@/lib/evidence/service";
import { presignDownload } from "@/lib/storage";

const paramsSchema = z.object({ id: z.string().min(1).max(64), evidenceId: z.string().min(1).max(64) });

/**
 * Unduhan bukti (docs/02 bagian 5): hak akses diperiksa di server, lalu dialihkan ke URL bertanda tangan
 * berumur 5 menit. Koordinator unit hanya dapat mengunduh bukti unitnya.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; evidenceId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, rolesFor("evidenceAndObservations", "read"));
    const item = await evidenceForDownload(access.assessmentId, parsed.data.evidenceId, access.unitScope);
    if (!item) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const ext = item.storageKey.split(".").pop() ?? "";
    const url = await presignDownload(item.storageKey, `${item.title} v${item.version}${ext ? `.${ext}` : ""}`);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
