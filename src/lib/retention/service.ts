import "server-only";
import { z } from "zod";
import type { AssessmentStatus } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/jobs/boss";

// Retensi dan pemusnahan (docs/04 bagian 7). Masa simpan data mentah dihitung sejak laporan final ditandatangani
// (bawaan 36 bulan, dari parameter terkunci). retention.scan mingguan menandai asesmen yang melewati masa simpan;
// SUPER_ADMIN memusnahkan data mentah setelah konfirmasi tertulis klien. Hasil agregat, ScoreRun final, laporan
// final, berita acara, dan jejak audit tetap disimpan.

export const DEFAULT_RETENTION_MONTHS = 36;
export { DESTROYED_CATEGORIES } from "./html";

/** Akhir masa simpan: tanggal tanda tangan laporan final ditambah sejumlah bulan; null bila belum ada laporan final. */
export function retentionEnd(finalReportSignedAt: Date | null, months: number): Date | null {
  if (!finalReportSignedAt) return null;
  const end = new Date(finalReportSignedAt);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}

function retentionMonths(parameterSnapshot: unknown): number {
  const months = (parameterSnapshot as { parameters?: { retention?: { rawDataMonths?: number } } } | null)?.parameters?.retention?.rawDataMonths;
  return typeof months === "number" && months > 0 ? months : DEFAULT_RETENTION_MONTHS;
}

async function retentionRows(now: Date) {
  const assessments = await getDb().assessment.findMany({
    where: { reports: { some: { kind: "FULL", status: "FINAL" } } },
    orderBy: [{ retentionFlaggedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      parameterSnapshot: true,
      retentionFlaggedAt: true,
      organization: { select: { name: true } },
      reports: { where: { kind: "FULL", status: "FINAL" }, orderBy: { signedAt: "asc" }, take: 1, select: { signedAt: true } },
      destructionRecords: { select: { id: true, executedAt: true, pdfStatus: true, objectCount: true } },
    },
  });
  return assessments.map((a) => {
    const months = retentionMonths(a.parameterSnapshot);
    const end = retentionEnd(a.reports[0]?.signedAt ?? null, months);
    return {
      id: a.id,
      name: a.name,
      organizationName: a.organization.name,
      status: a.status as AssessmentStatus,
      months,
      finalReportSignedAt: a.reports[0]?.signedAt ?? null,
      retentionEnd: end,
      expired: end !== null && end.getTime() <= now.getTime(),
      flaggedAt: a.retentionFlaggedAt,
      destruction: a.destructionRecords[0] ?? null,
    };
  });
}

export async function listRetention(now: Date = new Date()) {
  return retentionRows(now);
}

/** Tugas mingguan: menandai asesmen yang masa simpannya habis dan belum dimusnahkan. */
export async function scanRetention(now: Date = new Date()): Promise<number> {
  const due = (await retentionRows(now)).filter((r) => r.expired && !r.flaggedAt && !r.destruction && r.status !== "PURGED");
  const db = getDb();
  for (const r of due) {
    await db.$transaction(async (tx) => {
      await tx.assessment.update({ where: { id: r.id }, data: { retentionFlaggedAt: now } });
      await logAudit(tx, {
        action: "retention.flag",
        entityType: "Assessment",
        entityId: r.id,
        assessmentId: r.id,
        after: { retentionEnd: r.retentionEnd?.toISOString(), months: r.months, status: r.status },
      });
    });
  }
  return due.length;
}

export const destructionSchema = z.object({
  clientConfirmationRef: z.string().trim().min(3).max(200),
  clientConfirmedOn: z.iso.date(),
  clientConfirmedBy: z.string().trim().min(3).max(200),
  witnessName: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(2000).transform((v) => (v === "" ? null : v)),
  confirmed: z.literal(true),
});

/**
 * Memusnahkan data mentah satu asesmen berstatus ARCHIVED yang masa simpannya habis. Baris dihapus dalam satu
 * transaksi, berita acara dicatat, dan status menjadi PURGED; berkas di penyimpanan objek dihapus dan berita
 * acara PDF dirender oleh worker (destruction.process).
 */
export async function executeDestruction(session: SessionContext, assessmentId: string, input: z.output<typeof destructionSchema>, meta: RequestMeta, now: Date = new Date()): Promise<string> {
  if (!session.principal.isSuperAdmin) throw new AssessmentRuleError(403, "FORBIDDEN");
  return getDb().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`SELECT "status" FROM "Assessment" WHERE "id" = ${assessmentId} FOR UPDATE`;
    if (!rows[0]) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (rows[0].status !== "ARCHIVED") throw new AssessmentRuleError(409, "DESTRUCTION_STATUS", { status: rows[0].status });
    if (await tx.destructionRecord.count({ where: { assessmentId } })) throw new AssessmentRuleError(409, "ALREADY_DESTROYED");
    const a = await tx.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
      select: { organizationId: true, parameterSnapshot: true, reports: { where: { kind: "FULL", status: "FINAL" }, orderBy: { signedAt: "asc" }, take: 1, select: { signedAt: true } } },
    });
    const months = retentionMonths(a.parameterSnapshot);
    const end = retentionEnd(a.reports[0]?.signedAt ?? null, months);
    if (!end || end.getTime() > now.getTime()) throw new AssessmentRuleError(409, "RETENTION_NOT_EXPIRED", { retentionEnd: end?.toISOString() ?? null });

    const evidence = await tx.evidenceItem.findMany({ where: { assessmentId }, select: { storageKey: true } });
    const captures = await tx.observationCapture.findMany({ where: { window: { assessmentId } }, select: { storageKey: true } });
    const storageKeys = [...evidence.map((e) => e.storageKey), ...captures.map((c) => c.storageKey)];
    const counts = {
      selfAssessmentAnswers: await tx.selfAssessmentAnswer.count({ where: { selfAssessment: { assessmentId } } }),
      selfAssessments: (await tx.selfAssessment.deleteMany({ where: { assessmentId } })).count,
      accessTokens: (await tx.accessToken.deleteMany({ where: { assessmentId } })).count,
      rosterEntries: (await tx.rosterEntry.deleteMany({ where: { assessmentId } })).count,
      characteristicAnswers: await tx.characteristicAnswer.count({ where: { response: { assessmentId } } }),
      climateAnswers: await tx.climateAnswer.count({ where: { response: { assessmentId } } }),
      surveyResponses: 0,
      evidenceLinks: await tx.evidenceLink.count({ where: { evidenceItem: { assessmentId } } }),
      evidenceItems: 0,
      observationCaptures: (await tx.observationCapture.deleteMany({ where: { window: { assessmentId } } })).count,
      // Nama narasumber wawancara dan diskusi kelompok terarah adalah data pribadi mentah; jumlah peserta tetap tersimpan di sesi.
      validationParticipants: (await tx.validationParticipant.deleteMany({ where: { session: { assessmentId } } })).count,
      storageObjects: storageKeys.length,
    };
    counts.surveyResponses = (await tx.surveyResponse.deleteMany({ where: { assessmentId } })).count;
    counts.evidenceItems = (await tx.evidenceItem.deleteMany({ where: { assessmentId } })).count;
    const objectCount = Object.values(counts).reduce((s, n) => s + n, 0);

    const record = await tx.destructionRecord.create({
      data: {
        assessmentId,
        scope: "RAW_DATA",
        executedAt: now,
        executedById: session.user.id,
        objectCount,
        witnessName: input.witnessName,
        notes: input.notes,
        clientConfirmationRef: input.clientConfirmationRef,
        clientConfirmedOn: new Date(`${input.clientConfirmedOn}T00:00:00.000Z`),
        clientConfirmedBy: input.clientConfirmedBy,
        details: { counts, storageKeys, retentionMonths: months, finalReportSignedAt: a.reports[0]?.signedAt?.toISOString() ?? null, retentionEnd: end.toISOString() },
      },
      select: { id: true },
    });
    await tx.assessment.update({ where: { id: assessmentId }, data: { status: "PURGED" } });
    const actor = { id: session.user.id, role: "SUPER_ADMIN" as const };
    await logAudit(tx, { action: "assessment.status_change", entityType: "Assessment", entityId: assessmentId, actor, organizationId: a.organizationId, assessmentId, before: { status: "ARCHIVED" }, after: { status: "PURGED" }, meta });
    await logAudit(tx, {
      action: "retention.destroy",
      entityType: "DestructionRecord",
      entityId: record.id,
      actor,
      organizationId: a.organizationId,
      assessmentId,
      after: { counts, objectCount, clientConfirmationRef: input.clientConfirmationRef, witnessName: input.witnessName },
      meta,
    });
    await enqueue(tx, QUEUES.destructionProcess, { recordId: record.id }, { singletonKey: `destruction:${record.id}` });
    return record.id;
  });
}

export async function destructionRecordForDownload(recordId: string) {
  return getDb().destructionRecord.findUnique({ where: { id: recordId }, select: { id: true, assessmentId: true, storageKey: true, pdfStatus: true } });
}
