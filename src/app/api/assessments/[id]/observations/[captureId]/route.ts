import { z } from "zod";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { captureForDownload } from "@/lib/observations/service";
import { presignDownload } from "@/lib/storage";

const paramsSchema = z.object({ id: z.string().min(1).max(64), captureId: z.string().min(1).max(64) });
const querySchema = z.object({ inline: z.enum(["1"]).optional() });

/** Rekaman observasi; ?inline=1 untuk pratinjau di konsol. Hak akses diperiksa sebelum dialihkan ke URL 5 menit. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; captureId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success || !query.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, rolesFor("evidenceAndObservations", "read"));
    const capture = await captureForDownload(access.assessmentId, parsed.data.captureId, access.unitScope);
    if (!capture) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const ext = capture.storageKey.split(".").pop() ?? "";
    const name = `observasi-${capture.checklistItemCode}-${capture.serverCapturedAt.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`;
    const url = await presignDownload(capture.storageKey, name, query.data.inline === "1");
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
