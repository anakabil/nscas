// Retensi, pemusnahan data mentah, berita acara, dan jejak audit (docs/04 bagian 6 dan 7) terhadap PostgreSQL,
// pg-boss, MinIO, dan Chromium headless.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import messages from "../../messages/id.json";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
if (!process.env.PDF_CHROMIUM_EXECUTABLE && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) process.env.PDF_CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

const retention = await import("@/lib/retention/service");
const { processDestruction } = await import("@/lib/jobs/destruction");
const trail = await import("@/lib/audit-trail/service");
const { AssessmentRuleError } = await import("@/lib/assessments/service");
const { putObject, inspectObject } = await import("@/lib/storage");
const { stopBoss } = await import("@/lib/jobs/boss");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: "abc", userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const NOW = new Date("2029-11-10T03:00:00.000Z");
const input = { clientConfirmationRef: "001/K3/XI/2029", clientConfirmedOn: "2029-11-01", clientConfirmedBy: "Direktur Operasi", witnessName: "Rina Saksi", notes: null, confirmed: true as const };

type Session = Parameters<typeof retention.executeDestruction>[0];
let orgId: string;
let superAdmin: Session;
let notAdmin: Session;
let leadId: string;
let expiredId: string;
let recentId: string;
let monitoringId: string;
let evidenceKey: string;
let captureKey: string;

function session(userId: string, isSuperAdmin: boolean): Session {
  return { user: { id: userId, name: "x", email: "x" }, principal: { isSuperAdmin, memberships: [] } } as unknown as Session;
}

async function assessmentWithReport(name: string, status: "ARCHIVED" | "MONITORING", signedAt: Date, versionId: string) {
  const a = await db.assessment.create({
    data: {
      organizationId: orgId,
      name,
      scopeType: "CORPORATE",
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-09-30"),
      targetLevel: 4,
      instrumentVersionId: versionId,
      status,
      lockedAt: new Date("2026-07-20T03:00:00Z"),
      parameterSnapshot: { schemaVersion: 1, parameters: { retention: { rawDataMonths: 36 } } },
    },
  });
  await db.report.create({ data: { assessmentId: a.id, version: 1, kind: "FULL", status: "FINAL", signedAt, signerName: "Ir. Asesor Utama", signerPosition: "Lead Assessor" } });
  return a.id;
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected rejection");
}

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji Retensi ${suffix}`, legalName: `PT Uji Retensi Konstruksi ${suffix}`, sector: "Konstruksi" } });
  orgId = org.id;
  const sa = await db.user.create({ data: { email: `sa-m14-${suffix}@contoh.test`, name: "Admin Nusa Safety", passwordHash: "x" } });
  const lead = await db.user.create({ data: { email: `la-m14-${suffix}@contoh.test`, name: "Ir. Asesor Utama", passwordHash: "x" } });
  leadId = lead.id;
  superAdmin = session(sa.id, true);
  notAdmin = session(lead.id, false);
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M14-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspect = await db.aspect.create({ data: { instrumentVersionId: version.id, code: "A1", name: "Aspek uji", maxPointsStep5: 100 } });
  const characteristic = await db.characteristic.create({ data: { instrumentVersionId: version.id, aspectId: aspect.id, code: "K1.1", nameId: "Karakteristik uji", order: 1 } });

  // Laporan final 37 bulan sebelum NOW: masa simpan 36 bulan sudah habis.
  expiredId = await assessmentWithReport("Asesmen kedaluwarsa", "ARCHIVED", new Date("2026-10-01T03:00:00Z"), version.id);
  recentId = await assessmentWithReport("Asesmen baru", "ARCHIVED", new Date("2029-06-01T03:00:00Z"), version.id);
  monitoringId = await assessmentWithReport("Asesmen pemantauan", "MONITORING", new Date("2026-09-01T03:00:00Z"), version.id);

  const unit = await db.unit.create({ data: { assessmentId: expiredId, name: "Proyek Uji", type: "PROJECT" } });
  const stratum = await db.stratum.create({ data: { assessmentId: expiredId, code: "S4", name: "Pelaksana", group: "FIELD", population: 10 } });
  const roster = await db.rosterEntry.create({ data: { assessmentId: expiredId, unitId: unit.id, stratumId: stratum.id, fullName: "Budi Santoso" } });
  await db.accessToken.create({ data: { assessmentId: expiredId, rosterEntryId: roster.id, unitId: unit.id, stratumId: stratum.id, kind: "SURVEY", tokenHash: `h1-${suffix}` } });
  const saToken = await db.accessToken.create({ data: { assessmentId: expiredId, unitId: unit.id, kind: "SELF_ASSESSMENT", tokenHash: `h2-${suffix}` } });
  await db.selfAssessment.create({
    data: { assessmentId: expiredId, accessTokenId: saToken.id, respondentName: "Ir. Manajer Proyek", respondentPosition: "Manajer Proyek", answers: { create: [{ characteristicId: characteristic.id, level: 3 }] } },
  });
  for (let i = 0; i < 2; i++) {
    await db.surveyResponse.create({
      data: {
        assessmentId: expiredId,
        unitId: unit.id,
        stratumId: stratum.id,
        instrumentVersionId: version.id,
        language: "id",
        submittedOn: new Date("2026-08-20"),
        durationBucket: "FROM_10_TO_15",
        characteristicAnswers: { create: [{ characteristicId: characteristic.id, level: 3 }] },
      },
    });
  }
  evidenceKey = `${orgId}/${expiredId}/evidence/${suffix}.pdf`;
  captureKey = `${orgId}/${expiredId}/observation/${suffix}.jpg`;
  await putObject(evidenceKey, new TextEncoder().encode("%PDF-1.4 bukti"), "application/pdf");
  await putObject(captureKey, new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg");
  const evidence = await db.evidenceItem.create({ data: { assessmentId: expiredId, unitId: unit.id, title: "Risalah rapat", storageKey: evidenceKey, sha256: "a".repeat(64), mimeType: "application/pdf", sizeBytes: 14, uploadedById: lead.id } });
  await db.evidenceLink.create({ data: { evidenceItemId: evidence.id, characteristicId: characteristic.id } });
  const window = await db.observationWindow.create({ data: { assessmentId: expiredId, unitId: unit.id, opensAt: new Date("2026-08-01"), closesAt: new Date("2026-08-31"), checklist: [], latitude: -6.2, longitude: 106.8, radiusMeters: 500, createdById: lead.id } });
  await db.observationCapture.create({ data: { windowId: window.id, checklistItemCode: "OB1", storageKey: captureKey, sha256: "b".repeat(64), mimeType: "image/jpeg", uploadedById: lead.id } });
  const vs = await db.validationSession.create({ data: { assessmentId: expiredId, type: "INTERVIEW", label: "Wawancara manajer", status: "COMPLETED", participantCount: 1 } });
  await db.validationParticipant.create({ data: { sessionId: vs.id, fullName: "Siti Aminah", position: "Manajer" } });
  await db.scoreRun.create({ data: { assessmentId: expiredId, engineVersion: "test", parameterSnapshot: {}, inputSnapshot: {}, result: {}, runById: lead.id, isFinal: true, finalizedAt: new Date("2026-09-15T03:00:00Z") } });
});

afterAll(async () => {
  await stopBoss();
});

describe("masa simpan", () => {
  it("36 bulan sejak laporan final", () => {
    expect(retention.retentionEnd(new Date("2026-10-01T03:00:00Z"), 36)?.toISOString()).toBe("2029-10-01T03:00:00.000Z");
    expect(retention.retentionEnd(null, 36)).toBeNull();
  });

  it("retention.scan menandai asesmen kedaluwarsa satu kali dan mencatat jejak audit", async () => {
    const flagged = await retention.scanRetention(NOW);
    expect(flagged).toBeGreaterThanOrEqual(2);
    const rows = await db.assessment.findMany({ where: { id: { in: [expiredId, recentId, monitoringId] } }, select: { id: true, retentionFlaggedAt: true } });
    const byId = new Map(rows.map((r) => [r.id, r.retentionFlaggedAt]));
    expect(byId.get(expiredId)).toEqual(NOW);
    expect(byId.get(monitoringId)).toEqual(NOW);
    expect(byId.get(recentId)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "retention.flag", assessmentId: expiredId } })).toBe(1);
    await retention.scanRetention(NOW);
    expect(await db.auditLog.count({ where: { action: "retention.flag", assessmentId: expiredId } })).toBe(1);
  });

  it("daftar retensi memuat akhir masa simpan dan keadaan", async () => {
    const rows = await retention.listRetention(NOW);
    const recent = rows.find((r) => r.id === recentId)!;
    expect(recent).toMatchObject({ expired: false, months: 36, destruction: null });
    expect(recent.retentionEnd?.toISOString()).toBe("2032-06-01T03:00:00.000Z");
    expect(rows.find((r) => r.id === expiredId)).toMatchObject({ expired: true, flaggedAt: NOW });
  });
});

describe("pemusnahan data mentah", () => {
  it("hanya SUPER_ADMIN", async () => {
    const error = await rejection(retention.executeDestruction(notAdmin, expiredId, input, meta, NOW));
    expect(error).toBeInstanceOf(AssessmentRuleError);
    expect(error).toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("menolak asesmen yang belum diarsipkan atau masa simpannya belum habis", async () => {
    expect(await rejection(retention.executeDestruction(superAdmin, monitoringId, input, meta, NOW))).toMatchObject({ code: "DESTRUCTION_STATUS" });
    expect(await rejection(retention.executeDestruction(superAdmin, recentId, input, meta, NOW))).toMatchObject({ code: "RETENTION_NOT_EXPIRED" });
  });

  it("skema menolak tanpa konfirmasi tertulis klien dan tanpa centang", () => {
    expect(retention.destructionSchema.safeParse({ ...input, clientConfirmationRef: "" }).success).toBe(false);
    expect(retention.destructionSchema.safeParse({ ...input, clientConfirmedOn: "1 November 2029" }).success).toBe(false);
    expect(retention.destructionSchema.safeParse({ ...input, notes: "", confirmed: false }).success).toBe(false);
    expect(retention.destructionSchema.safeParse({ ...input, notes: "" }).success).toBe(true);
  });

  let recordId: string;

  it("menghapus data mentah, menyimpan hasil, dan mencatat berita acara", async () => {
    recordId = await retention.executeDestruction(superAdmin, expiredId, input, meta, NOW);
    const scope = { assessmentId: expiredId };
    expect(await db.rosterEntry.count({ where: scope })).toBe(0);
    expect(await db.accessToken.count({ where: scope })).toBe(0);
    expect(await db.surveyResponse.count({ where: scope })).toBe(0);
    expect(await db.characteristicAnswer.count({ where: { response: scope } })).toBe(0);
    expect(await db.selfAssessment.count({ where: scope })).toBe(0);
    expect(await db.evidenceItem.count({ where: scope })).toBe(0);
    expect(await db.observationCapture.count({ where: { window: scope } })).toBe(0);
    expect(await db.validationParticipant.count({ where: { session: scope } })).toBe(0);
    // Yang disimpan: ScoreRun final, laporan final, sesi validasi (tanpa nama), jejak audit.
    expect(await db.scoreRun.count({ where: { ...scope, isFinal: true } })).toBe(1);
    expect(await db.report.count({ where: { ...scope, status: "FINAL" } })).toBe(1);
    expect(await db.validationSession.findFirstOrThrow({ where: scope })).toMatchObject({ participantCount: 1 });

    const record = await db.destructionRecord.findUniqueOrThrow({ where: { id: recordId } });
    expect(record).toMatchObject({ scope: "RAW_DATA", executedById: superAdmin.user.id, witnessName: "Rina Saksi", clientConfirmationRef: "001/K3/XI/2029", clientConfirmedBy: "Direktur Operasi", pdfStatus: "PENDING", storageKey: null });
    expect(record.clientConfirmedOn?.toISOString()).toBe("2029-11-01T00:00:00.000Z");
    const details = record.details as { counts: Record<string, number>; storageKeys: string[] };
    expect(details.counts).toMatchObject({ rosterEntries: 1, accessTokens: 2, surveyResponses: 2, characteristicAnswers: 2, selfAssessments: 1, selfAssessmentAnswers: 1, evidenceItems: 1, evidenceLinks: 1, observationCaptures: 1, validationParticipants: 1, storageObjects: 2 });
    expect(details.storageKeys.sort()).toEqual([evidenceKey, captureKey].sort());
    expect(record.objectCount).toBe(Object.values(details.counts).reduce((s, n) => s + n, 0));

    expect((await db.assessment.findUniqueOrThrow({ where: { id: expiredId } })).status).toBe("PURGED");
    const actions = (await db.auditLog.findMany({ where: { assessmentId: expiredId, action: { in: ["assessment.status_change", "retention.destroy"] } }, select: { action: true, actorRole: true } })).map((a) => a.action).sort();
    expect(actions).toEqual(["assessment.status_change", "retention.destroy"]);
    const jobs = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pgboss.job WHERE name = 'destruction.process' AND data->>'recordId' = ${recordId}`;
    expect(Number(jobs[0]!.n)).toBe(1);
  });

  it("tidak dapat dijalankan dua kali", async () => {
    expect(await rejection(retention.executeDestruction(superAdmin, expiredId, input, meta, NOW))).toMatchObject({ status: 409 });
  });

  it("isi berita acara tidak dapat diubah atau dihapus", async () => {
    await expect(db.destructionRecord.update({ where: { id: recordId }, data: { witnessName: "Orang lain" } })).rejects.toThrow(/immutable/);
    await expect(db.destructionRecord.delete({ where: { id: recordId } })).rejects.toThrow(/permanent/);
  });

  it("destruction.process menghapus berkas, merender PDF, dan idempoten", async () => {
    expect(await inspectObject(evidenceKey, 16)).not.toBeNull();
    expect(await processDestruction({ recordId })).toBe("DONE");
    expect(await inspectObject(evidenceKey, 16)).toBeNull();
    expect(await inspectObject(captureKey, 16)).toBeNull();
    const record = await db.destructionRecord.findUniqueOrThrow({ where: { id: recordId } });
    expect(record).toMatchObject({ pdfStatus: "READY" });
    expect(record.objectsPurgedAt).toBeInstanceOf(Date);
    expect(record.storageKey).toBe(`${orgId}/${expiredId}/destruction/berita-acara-${recordId}.pdf`);
    const pdf = await inspectObject(record.storageKey!, 10 * 1024 * 1024);
    expect(pdf!.size).toBeGreaterThan(1000);
    expect(pdf?.head && Buffer.from(pdf.head.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(await db.auditLog.count({ where: { action: "retention.minutes", entityId: recordId } })).toBe(1);
    expect(await processDestruction({ recordId })).toBe("SKIPPED");
  }, 60_000);

  it("berkas yang sudah dihapus tidak dihapus ulang bila render diulang", async () => {
    const removed: string[] = [];
    const other = await db.assessment.findUniqueOrThrow({ where: { id: recentId } });
    expect(other.status).toBe("ARCHIVED");
    // Catatan baru dengan objectsPurgedAt sudah terisi: hanya PDF yang dirender.
    const rec = await db.destructionRecord.create({
      data: { assessmentId: recentId, scope: "RAW_DATA", executedAt: NOW, executedById: superAdmin.user.id, objectCount: 0, witnessName: "Saksi", details: { counts: {}, storageKeys: ["tidak/ada.pdf"], retentionMonths: 36, finalReportSignedAt: null, retentionEnd: null }, objectsPurgedAt: NOW },
    });
    const result = await processDestruction({ recordId: rec.id }, { remove: async (k) => void removed.push(k), toPdf: async () => new TextEncoder().encode("%PDF-uji"), put: async () => {} });
    expect(result).toBe("DONE");
    expect(removed).toEqual([]);
  });
});

describe("jejak audit", () => {
  const labels = messages.auditTrail.csv;

  it("lead assessor melihat isi perubahan; administrator klien tidak", async () => {
    const full = await trail.loadAuditTrail({ assessmentId: expiredId, organizationId: orgId, roles: ["LEAD_ASSESSOR"] });
    expect(full.full).toBe(true);
    expect(full.total).toBeGreaterThanOrEqual(3);
    const destroy = full.entries.find((e) => e.action === "retention.destroy")!;
    expect(destroy.actorName).toBe("Admin Nusa Safety");
    expect(destroy.detail?.after).toMatchObject({ witnessName: "Rina Saksi" });
    const client = await trail.loadAuditTrail({ assessmentId: expiredId, organizationId: orgId, roles: ["CLIENT_ADMIN"] });
    expect(client.full).toBe(false);
    expect(client.entries.every((e) => e.detail === null && e.actorEmail === null)).toBe(true);
  });

  it("tidak membocorkan catatan organisasi lain", async () => {
    const other = await trail.loadAuditTrail({ assessmentId: expiredId, organizationId: "organisasi-lain", roles: ["LEAD_ASSESSOR"] });
    expect(other.entries.every((e) => e.action === "retention.flag" || e.action === "retention.minutes")).toBe(true);
  });

  it("ekspor CSV memakai BOM, pemisah titik koma, urutan kronologis, dan dicatat sebagai audit.export", async () => {
    await db.$transaction((tx) =>
      tx.auditLog.create({ data: { action: "evidence.upload", entityType: "EvidenceItem", assessmentId: expiredId, organizationId: orgId, actorId: leadId, after: { title: "=HYPERLINK(\"http://contoh\")" }, at: new Date("2026-08-02T00:00:00Z") } }),
    );
    const { csv, rows } = await trail.exportAuditTrail({ assessmentId: expiredId, organizationId: orgId, roles: ["LEAD_ASSESSOR"], actorId: leadId }, labels, "Asia/Jakarta", "Sistem", meta);
    expect(csv.startsWith("﻿waktu_utc;waktu_wib;aksi;")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(rows + 1);
    expect(lines[1]).toContain("evidence.upload");
    expect(lines.some((l) => l.includes(";Sistem;"))).toBe(true);
    // JSON yang memuat rumus tetap di dalam sel berkutip, dan sel tidak diawali tanda sama dengan.
    expect(csv).not.toMatch(/;=|^=/m);
    expect(await db.auditLog.count({ where: { action: "audit.export", assessmentId: expiredId, actorId: leadId } })).toBe(1);
  });
});
