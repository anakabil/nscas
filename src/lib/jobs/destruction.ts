import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { renderDestructionHtml } from "@/lib/retention/html";
import { deleteObject, putObject } from "@/lib/storage";
import { PALETTE } from "@/lib/theme";
import { chromiumPdf } from "./report-render";

// destruction.process (docs/04 bagian 7): menghapus berkas bukti dan rekaman observasi dari penyimpanan objek,
// lalu merender berita acara pemusnahan ke PDF dan mencatatnya di DestructionRecord. Penghapusan berkas idempoten,
// sehingga aman diulang bila pekerjaan gagal di tengah jalan.

export interface DestructionJob {
  recordId: string;
}

export interface DestructionDeps {
  remove: (key: string) => Promise<void>;
  toPdf: (html: string, footer: string) => Promise<Uint8Array>;
  put: (key: string, body: Uint8Array, contentType: string) => Promise<void>;
}

export const defaultDestructionDeps = (): DestructionDeps => ({ remove: deleteObject, toPdf: chromiumPdf, put: putObject });

export async function processDestruction(job: DestructionJob, deps: DestructionDeps = defaultDestructionDeps()): Promise<"DONE" | "SKIPPED"> {
  const db = getDb();
  const record = await db.destructionRecord.findUnique({
    where: { id: job.recordId },
    select: {
      id: true,
      assessmentId: true,
      executedAt: true,
      witnessName: true,
      notes: true,
      clientConfirmationRef: true,
      clientConfirmedOn: true,
      clientConfirmedBy: true,
      details: true,
      pdfStatus: true,
      objectsPurgedAt: true,
      executedBy: { select: { name: true } },
      assessment: { select: { name: true, organizationId: true, organization: { select: { legalName: true } } } },
    },
  });
  if (!record || record.pdfStatus === "READY") return "SKIPPED";
  const details = record.details as { counts: Record<string, number>; storageKeys: string[]; retentionMonths: number; finalReportSignedAt: string | null; retentionEnd: string | null };

  if (!record.objectsPurgedAt) {
    for (const key of details.storageKeys) await deps.remove(key);
    await db.destructionRecord.update({ where: { id: record.id }, data: { objectsPurgedAt: new Date() } });
  }

  const root = process.cwd();
  const logo = await readFile(join(root, "public/brand/logo-long-color.png"));
  const font = await readFile(join(root, "public/fonts/PlusJakartaSans-latin-wght-normal.woff2")).catch(() => null);
  const html = renderDestructionHtml(
    {
      recordId: record.id,
      organization: record.assessment.organization.legalName,
      assessment: record.assessment.name,
      executedAt: record.executedAt.toISOString(),
      executedBy: record.executedBy.name,
      witnessName: record.witnessName,
      notes: record.notes,
      clientConfirmationRef: record.clientConfirmationRef,
      clientConfirmedOn: record.clientConfirmedOn?.toISOString() ?? null,
      clientConfirmedBy: record.clientConfirmedBy,
      finalReportSignedAt: details.finalReportSignedAt,
      retentionMonths: details.retentionMonths,
      retentionEnd: details.retentionEnd,
      counts: details.counts,
    },
    { logoSrc: `data:image/png;base64,${logo.toString("base64")}`, fontSrc: font ? `data:font/woff2;base64,${font.toString("base64")}` : null },
  );
  const pdf = await deps.toPdf(html, `<div style="font-family:sans-serif;font-size:8px;width:100%;padding:0 16mm;color:${PALETTE.textMuted};text-align:right"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`);
  const key = `${record.assessment.organizationId}/${record.assessmentId}/destruction/berita-acara-${record.id}.pdf`;
  await deps.put(key, pdf, "application/pdf");
  await db.$transaction(async (tx) => {
    await tx.destructionRecord.update({ where: { id: record.id }, data: { storageKey: key, pdfStatus: "READY", renderedAt: new Date() } });
    await logAudit(tx, {
      action: "retention.minutes",
      entityType: "DestructionRecord",
      entityId: record.id,
      organizationId: record.assessment.organizationId,
      assessmentId: record.assessmentId,
      after: { objectsDeleted: details.storageKeys.length, bytes: pdf.byteLength },
    });
  });
  return "DONE";
}
