import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, ReportKind, Role } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/jobs/boss";
import { buildReportContent } from "./content";

// Versi laporan (docs/01 M11). Satu versi terdiri atas tiga dokumen dengan snapshot isi yang sama: laporan
// asesmen, ringkasan eksekutif, dan pernyataan hasil. PDF dirender worker melalui report.render. Finalisasi
// menandatangani ketiganya sekaligus dan menguncinya (pemicu basis data Report_guard).

type Tx = Prisma.TransactionClient;

export interface ReportActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
}

export const REPORT_STATUSES: readonly AssessmentStatus[] = ["ACTION_PLANNING", "REPORTED", "MONITORING"];
export const REPORT_KINDS: readonly ReportKind[] = ["FULL", "EXECUTIVE_SUMMARY", "STATEMENT"];

async function lockStatus(tx: Tx, assessmentId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`SELECT "status" FROM "Assessment" WHERE "id" = ${assessmentId} FOR UPDATE`;
  if (!rows[0]) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (!REPORT_STATUSES.includes(rows[0].status)) throw new AssessmentRuleError(409, "REPORT_CLOSED", { status: rows[0].status });
}

export async function createReportVersion(actor: ReportActor, meta: RequestMeta): Promise<number> {
  const db = getDb();
  const status = await db.assessment.findUniqueOrThrow({ where: { id: actor.assessmentId }, select: { status: true } });
  if (!REPORT_STATUSES.includes(status.status)) throw new AssessmentRuleError(409, "REPORT_CLOSED", { status: status.status });
  if (!(await db.scoreRun.count({ where: { assessmentId: actor.assessmentId, isFinal: true } }))) throw new AssessmentRuleError(409, "RESULT_NOT_FINAL");
  // Snapshot disusun sebelum transaksi (banyak kueri baca); nomor versi ditetapkan di dalam transaksi.
  const content = await buildReportContent(actor.assessmentId, 0);
  return db.$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId);
    const last = await tx.report.aggregate({ where: { assessmentId: actor.assessmentId }, _max: { version: true } });
    const version = (last._max.version ?? 0) + 1;
    const snapshot = { ...content, version } as unknown as Prisma.InputJsonObject;
    const ids: string[] = [];
    for (const kind of REPORT_KINDS) {
      const report = await tx.report.create({ data: { assessmentId: actor.assessmentId, version, kind, content: snapshot, createdById: actor.session.user.id }, select: { id: true } });
      ids.push(report.id);
      await enqueue(tx, QUEUES.reportRender, { reportId: report.id }, { singletonKey: `report:${report.id}:draft` });
    }
    await logAudit(tx, {
      action: "report.create",
      entityType: "Report",
      entityId: ids[0] as string,
      actor: { id: actor.session.user.id, role: actor.roles[0] ?? null },
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: { version, reportIds: ids, organizationIndex: content.result.organization.index },
      meta,
    });
    return version;
  });
}

export async function finalizeReportVersion(actor: ReportActor, version: number, position: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId);
    const reports = await tx.report.findMany({ where: { assessmentId: actor.assessmentId, version }, select: { id: true, status: true } });
    if (reports.length === 0) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (reports.some((r) => r.status === "FINAL")) throw new AssessmentRuleError(409, "REPORT_FINAL");
    const signer = await tx.user.findUniqueOrThrow({ where: { id: actor.session.user.id }, select: { name: true } });
    const signedAt = new Date();
    for (const r of reports) {
      await tx.report.update({
        where: { id: r.id },
        data: { status: "FINAL", signedById: actor.session.user.id, signedAt, signerName: signer.name, signerPosition: position, pdfStatus: "PENDING", storageKey: null, renderedAt: null, renderError: null },
      });
      await enqueue(tx, QUEUES.reportRender, { reportId: r.id }, { singletonKey: `report:${r.id}:final` });
    }
    await logAudit(tx, {
      action: "report.finalize",
      entityType: "Report",
      entityId: reports[0]!.id,
      actor: { id: actor.session.user.id, role: actor.roles[0] ?? null },
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: { version, signerName: signer.name, signerPosition: position, signedAt: signedAt.toISOString() },
      meta,
    });
  });
}

export async function listReports(assessmentId: string, includeDrafts: boolean) {
  const reports = await getDb().report.findMany({
    where: { assessmentId, ...(includeDrafts ? {} : { status: "FINAL" }) },
    orderBy: [{ version: "desc" }, { kind: "asc" }],
    select: { id: true, version: true, kind: true, status: true, pdfStatus: true, storageKey: true, renderError: true, signerName: true, signerPosition: true, signedAt: true, createdAt: true, createdBy: { select: { name: true } } },
  });
  const versions = new Map<number, typeof reports>();
  for (const r of reports) versions.set(r.version, [...(versions.get(r.version) ?? []), r]);
  return [...versions.entries()].map(([version, docs]) => ({
    version,
    status: docs[0]!.status,
    createdAt: docs[0]!.createdAt,
    createdByName: docs[0]!.createdBy?.name ?? "",
    signerName: docs[0]!.signerName,
    signerPosition: docs[0]!.signerPosition,
    signedAt: docs[0]!.signedAt,
    documents: [...docs].sort((a, b) => REPORT_KINDS.indexOf(a.kind) - REPORT_KINDS.indexOf(b.kind)),
  }));
}

export async function reportForView(assessmentId: string, reportId: string, includeDrafts: boolean) {
  return getDb().report.findFirst({
    where: { id: reportId, assessmentId, ...(includeDrafts ? {} : { status: "FINAL" }) },
    select: { id: true, kind: true, version: true, status: true, content: true, storageKey: true, pdfStatus: true, signerName: true, signerPosition: true, signedAt: true },
  });
}
