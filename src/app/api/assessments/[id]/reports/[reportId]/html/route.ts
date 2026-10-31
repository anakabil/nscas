import { z } from "zod";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { REPORT_ROLES } from "@/lib/auth/roles";
import { renderReportHtml } from "@/lib/report/html";
import { reportForView } from "@/lib/report/service";
import type { ReportContent } from "@/lib/report/types";
import { REPORT_ASSET_FILES } from "@/lib/report/assets";

const paramsSchema = z.object({ id: z.string().min(1).max(64), reportId: z.string().min(1).max(64) });

/** Halaman laporan HTML siap cetak A4 (docs/01 M11). Draf hanya untuk asesor Nusa Safety. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, REPORT_ROLES.read);
    const drafts = access.roles.some((r) => (REPORT_ROLES.drafts as readonly string[]).includes(r));
    const report = await reportForView(access.assessmentId, parsed.data.reportId, drafts);
    if (!report?.content) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const html = renderReportHtml(
      report.content as unknown as ReportContent,
      report.kind,
      { status: report.status, signerName: report.signerName, signerPosition: report.signerPosition, signedAt: report.signedAt?.toISOString() ?? null },
      {
        logoSrc: `/${REPORT_ASSET_FILES.logo}`,
        fontSrc: `/${REPORT_ASSET_FILES.font}`,
        coverSrc: `/${REPORT_ASSET_FILES.cover}`,
        levelBadgeSrcs: REPORT_ASSET_FILES.levelBadges.map((file) => `/${file}`),
      },
    );
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
