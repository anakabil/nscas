import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { createTranslator } from "use-intl/core";
import id from "../../../messages/id.json";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { REPORT_FILE_NAMES, renderReportHtml, type ReportAssets } from "@/lib/report/html";
import type { ReportContent } from "@/lib/report/types";
import { PALETTE } from "@/lib/theme";
import { putObject } from "@/lib/storage";

// Render PDF laporan (docs/01 M11) di worker: HTML laporan disajikan ke Chromium headless (Playwright) dan
// dicetak A4 dengan nomor halaman, lalu disimpan ke penyimpanan objek. Aset disematkan sebagai data URI sehingga
// render tidak memerlukan jaringan. Hasil hanya disimpan bila status dan tanda tangan laporan tidak berubah
// selama render, agar PDF draf yang terlambat tidak menimpa PDF final.

export interface ReportRenderJob {
  reportId: string;
}

export interface RenderDeps {
  toPdf: (html: string, footer: string) => Promise<Uint8Array>;
  put: (key: string, body: Uint8Array, contentType: string) => Promise<void>;
}

async function inlineAssets(): Promise<ReportAssets> {
  const root = process.cwd();
  const [logo, font] = await Promise.all([
    readFile(join(root, "public/brand/logo-long-color.png")),
    readFile(join(root, "public/fonts/PlusJakartaSans-latin-wght-normal.woff2")).catch(() => null),
  ]);
  return { logoSrc: `data:image/png;base64,${logo.toString("base64")}`, fontSrc: font ? `data:font/woff2;base64,${font.toString("base64")}` : null };
}

/** Chromium dari PDF_CHROMIUM_EXECUTABLE, atau peramban Playwright yang terpasang (PLAYWRIGHT_BROWSERS_PATH). */
export async function chromiumPdf(html: string, footer: string): Promise<Uint8Array> {
  const browser = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}

export const defaultRenderDeps = (): RenderDeps => ({ toPdf: chromiumPdf, put: putObject });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

export async function renderReport(job: ReportRenderJob, deps: RenderDeps = defaultRenderDeps()): Promise<"RENDERED" | "SKIPPED"> {
  const db = getDb();
  const report = await db.report.findUnique({
    where: { id: job.reportId },
    select: { id: true, kind: true, version: true, status: true, content: true, signedAt: true, signerName: true, signerPosition: true, assessmentId: true, assessment: { select: { organizationId: true } } },
  });
  if (!report?.content) return "SKIPPED";
  const content = report.content as unknown as ReportContent;
  const html = renderReportHtml(
    content,
    report.kind,
    { status: report.status, signerName: report.signerName, signerPosition: report.signerPosition, signedAt: report.signedAt?.toISOString() ?? null },
    await inlineAssets(),
  );
  const t = createTranslator({ locale: "id", messages: id, namespace: "report" });
  const footer = `<div style="font-family:sans-serif;font-size:8px;width:100%;padding:0 16mm;color:${PALETTE.textMuted};display:flex;justify-content:space-between"><span>${escapeHtml(`${content.organization.name} · ${t(`kinds.${report.kind}`)} · ${t("version", { version: report.version })} · ${t(`statuses.${report.status}`)}`)}</span><span>${escapeHtml(t("pageOf", { page: "\u0000", total: "\u0001" })).replace("\u0000", '<span class="pageNumber"></span>').replace("\u0001", '<span class="totalPages"></span>')}</span></div>`;
  try {
    const pdf = await deps.toPdf(html, footer);
    const key = `${report.assessment.organizationId}/${report.assessmentId}/reports/${REPORT_FILE_NAMES[report.kind]}-v${report.version}-${report.status.toLowerCase()}-${report.id}.pdf`;
    await deps.put(key, pdf, "application/pdf");
    const saved = await db.$transaction(async (tx) => {
      const updated = await tx.report.updateMany({
        where: { id: report.id, status: report.status, signedAt: report.signedAt },
        data: { storageKey: key, pdfStatus: "READY", renderedAt: new Date(), renderError: null },
      });
      if (updated.count === 0) return false;
      await logAudit(tx, {
        action: "report.render",
        entityType: "Report",
        entityId: report.id,
        organizationId: report.assessment.organizationId,
        assessmentId: report.assessmentId,
        after: { kind: report.kind, version: report.version, status: report.status, bytes: pdf.byteLength },
      });
      return true;
    });
    return saved ? "RENDERED" : "SKIPPED";
  } catch (error) {
    await db.report.updateMany({ where: { id: report.id, status: report.status, signedAt: report.signedAt }, data: { pdfStatus: "FAILED", renderError: String(error instanceof Error ? error.message : error).slice(0, 500) } });
    throw error;
  }
}
