import { z } from "zod";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { REPORT_ROLES } from "@/lib/auth/roles";
import { REPORT_FILE_NAMES } from "@/lib/report/html";
import { reportForView } from "@/lib/report/service";
import { presignDownload } from "@/lib/storage";

const paramsSchema = z.object({ id: z.string().min(1).max(64), reportId: z.string().min(1).max(64) });

/** Unduhan PDF laporan: hak akses diperiksa di server, lalu dialihkan ke URL bertanda tangan berumur 5 menit. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, REPORT_ROLES.read);
    const drafts = access.roles.some((r) => (REPORT_ROLES.drafts as readonly string[]).includes(r));
    const report = await reportForView(access.assessmentId, parsed.data.reportId, drafts);
    if (!report) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    if (report.pdfStatus !== "READY" || !report.storageKey) return Response.json({ error: "PDF_NOT_READY" }, { status: 409 });
    const name = `${REPORT_FILE_NAMES[report.kind]}-v${report.version}${report.status === "DRAFT" ? "-draf" : ""}.pdf`;
    const url = await presignDownload(report.storageKey, name);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
