// Penilaian mandiri manajemen (docs/01 M4) terhadap PostgreSQL.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.APP_URL = "https://nscas.contoh.test";

const sa = await import("@/lib/self-assessment/service");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const REASON = "Rapat keselamatan bulanan dipimpin direktur operasi, notulennya ditindaklanjuti dalam dua minggu.";
const tokenOf = (link: string) => link.split("/").pop() as string;

let assessmentId: string;
let unitId: string;
let actor: Parameters<typeof sa.issueSelfAssessment>[0];
let characteristics: { id: string; statements: { id: string; level: number }[] }[];
let evidenceId: string;
let foreignEvidenceId: string;

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji M4 ${suffix}`, legalName: `PT Uji M4 ${suffix}` } });
  const user = await db.user.create({ data: { email: `ca-m4-${suffix}@contoh.test`, name: "Admin Klien M4", passwordHash: "x" } });
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M4-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspect = await db.aspect.create({ data: { instrumentVersionId: version.id, code: "A1", name: "Aspek uji" } });
  characteristics = [];
  for (let c = 1; c <= 3; c++) {
    const created = await db.characteristic.create({
      data: {
        instrumentVersionId: version.id,
        aspectId: aspect.id,
        code: `K1.${c}`,
        nameId: `Karakteristik ${c}`,
        order: c,
        levelStatements: { create: [1, 2, 3, 4, 5].map((level) => ({ level, textId: `Pernyataan ${c}.${level}` })) },
      },
      select: { id: true, levelStatements: { select: { id: true, level: true } } },
    });
    characteristics.push({ id: created.id, statements: created.levelStatements });
  }
  const base = { scopeType: "CORPORATE" as const, periodStart: new Date("2026-11-01"), periodEnd: new Date("2027-01-31"), targetLevel: 3, instrumentVersionId: version.id };
  assessmentId = (await db.assessment.create({ data: { ...base, organizationId: org.id, name: "Asesmen Uji M4", status: "DRAFT" }, select: { id: true } })).id;
  const other = await db.assessment.create({ data: { ...base, organizationId: org.id, name: "Asesmen Lain M4" }, select: { id: true } });
  unitId = (await db.unit.create({ data: { assessmentId, name: "Kantor Pusat", type: "HEAD_OFFICE" }, select: { id: true } })).id;
  const evidence = (assessment: string, title: string) =>
    db.evidenceItem.create({
      data: { assessmentId: assessment, title, storageKey: `${org.id}/${assessment}/evidence/${randomBytes(6).toString("hex")}.pdf`, sha256: "0".repeat(64), mimeType: "application/pdf", sizeBytes: 1000, uploadedById: user.id },
      select: { id: true },
    });
  evidenceId = (await evidence(assessmentId, "Notulen rapat keselamatan")).id;
  await db.evidenceLink.create({ data: { evidenceItemId: evidenceId, characteristicId: characteristics[0]!.id } });
  foreignEvidenceId = (await evidence(other.id, "Bukti asesmen lain")).id;
  actor = { session: { user: { id: user.id } } as never, assessmentId, organizationId: org.id, roles: ["CLIENT_ADMIN"] };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("penerbitan oleh administrator klien", () => {
  it("ditolak sebelum konfigurasi dikunci", async () => {
    await expect(sa.issueSelfAssessment(actor, { name: "Budi", position: "Direktur", unitId }, meta)).rejects.toMatchObject({ code: "DISTRIBUTION_CLOSED" });
  });

  it("menerbitkan tautan /sa yang hanya disimpan hash-nya, dengan jejak audit", async () => {
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "LOCKED" } });
    const issued = await sa.issueSelfAssessment(actor, { name: "Budi Santoso", position: "Direktur Operasi", unitId }, meta);
    expect(issued.link).toMatch(/^https:\/\/nscas\.contoh\.test\/sa\/[A-Za-z0-9_-]{43}$/);
    const record = await db.selfAssessment.findUniqueOrThrow({ where: { id: issued.id }, include: { accessToken: true } });
    expect(record).toMatchObject({ status: "DRAFT", respondentName: "Budi Santoso", respondentPosition: "Direktur Operasi" });
    expect(record.accessToken).toMatchObject({ kind: "SELF_ASSESSMENT", unitId, revokedAt: null });
    expect(JSON.stringify(record)).not.toContain(tokenOf(issued.link));
    expect(await db.auditLog.count({ where: { entityId: issued.id, action: "selfAssessment.issue" } })).toBe(1);
    expect(await sa.listSelfAssessments(assessmentId)).toMatchObject([{ name: "Budi Santoso", status: "DRAFT", revoked: false, opened: false, answered: 0 }]);
  });
});

describe("pengisian melalui tautan", () => {
  let raw: string;
  let id: string;

  beforeAll(async () => {
    const issued = await sa.issueSelfAssessment(actor, { name: "Siti Aminah", position: "Manajer K3", unitId }, meta);
    raw = tokenOf(issued.link);
    id = issued.id;
  });

  it("memuat formulir dengan bukti terbaru dan urutan pernyataan tetap", async () => {
    const access = await sa.resolveSelfAssessmentToken(raw);
    expect(access).toMatchObject({ state: "READY", selfAssessmentId: id });
    if (access.state !== "READY") return;
    const form = await sa.loadSelfAssessmentForm(access);
    expect(form.characteristics).toHaveLength(3);
    expect(form.evidence).toEqual([{ id: evidenceId, title: "Notulen rapat keselamatan", version: 1, characteristicIds: [characteristics[0]!.id] }]);
    expect(await sa.loadSelfAssessmentForm(access)).toEqual(form);
  });

  it("menyimpan identitas dan draf per karakteristik di server, tercatat di jejak audit", async () => {
    expect(await sa.saveSelfAssessmentProfile(raw, { name: "Siti Aminah, S.T.", position: "Manajer K3 Korporat" }, meta)).toEqual({ ok: true });
    const first = characteristics[0]!;
    const statement = first.statements.find((s) => s.level === 4)!;
    expect(await sa.saveSelfAssessmentAnswer(raw, { characteristicId: first.id, statementId: statement.id, justification: REASON, evidenceIds: [evidenceId] }, meta)).toEqual({ ok: true });
    // Draf boleh belum lengkap.
    expect(await sa.saveSelfAssessmentAnswer(raw, { characteristicId: characteristics[1]!.id, statementId: null, justification: "Belum selesai", evidenceIds: [] }, meta)).toEqual({ ok: true });

    const answers = await db.selfAssessmentAnswer.findMany({ where: { selfAssessmentId: id }, orderBy: { createdAt: "asc" } });
    expect(answers.map((a) => [a.level, a.evidenceIds])).toEqual([
      [4, [evidenceId]],
      [null, []],
    ]);
    expect(await db.auditLog.count({ where: { entityId: id, action: { in: ["selfAssessment.profile_update", "selfAssessment.answer_save"] } } })).toBe(3);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: id, action: "selfAssessment.answer_save" }, orderBy: { at: "asc" } });
    expect(audit.actorId).toBeNull();
    expect(audit.after).toMatchObject({ characteristic: "K1.1", level: 4, justification: REASON });
  });

  it("menolak pernyataan dari karakteristik lain dan bukti dari asesmen lain", async () => {
    const wrong = characteristics[1]!.statements[0]!.id;
    expect(await sa.saveSelfAssessmentAnswer(raw, { characteristicId: characteristics[0]!.id, statementId: wrong, justification: REASON, evidenceIds: [] }, meta)).toMatchObject({ code: "UNKNOWN_ITEM" });
    expect(await sa.saveSelfAssessmentAnswer(raw, { characteristicId: characteristics[0]!.id, statementId: null, justification: REASON, evidenceIds: [foreignEvidenceId] }, meta)).toMatchObject({ code: "UNKNOWN_EVIDENCE" });
  });

  it("tidak dapat dikirim tanpa pernyataan atau dengan alasan kurang dari 50 karakter", async () => {
    const result = await sa.submitSelfAssessment(raw, meta);
    expect(result).toMatchObject({ ok: false, status: 422, code: "INCOMPLETE" });
    if (result.ok) return;
    expect(result.missing).toEqual([
      { characteristicId: characteristics[1]!.id, reasons: ["LEVEL", "JUSTIFICATION"] },
      { characteristicId: characteristics[2]!.id, reasons: ["LEVEL", "JUSTIFICATION"] },
    ]);
    await sa.saveSelfAssessmentAnswer(raw, { characteristicId: characteristics[1]!.id, statementId: characteristics[1]!.statements[0]!.id, justification: "x".repeat(49), evidenceIds: [] }, meta);
    expect(await sa.submitSelfAssessment(raw, meta)).toMatchObject({ code: "INCOMPLETE" });
  });

  it("status SUBMITTED mengunci jawaban", async () => {
    for (const c of characteristics.slice(1)) {
      await sa.saveSelfAssessmentAnswer(raw, { characteristicId: c.id, statementId: c.statements.find((s) => s.level === 3)!.id, justification: REASON, evidenceIds: [] }, meta);
    }
    expect(await sa.submitSelfAssessment(raw, meta)).toEqual({ ok: true });
    const record = await db.selfAssessment.findUniqueOrThrow({ where: { id }, include: { accessToken: true } });
    expect(record.status).toBe("SUBMITTED");
    expect(record.submittedAt).not.toBeNull();
    expect(record.accessToken.completedAt).not.toBeNull();

    expect(await sa.saveSelfAssessmentAnswer(raw, { characteristicId: characteristics[0]!.id, statementId: null, justification: "", evidenceIds: [] }, meta)).toEqual({
      ok: false,
      status: 409,
      code: "SELF_ASSESSMENT_SUBMITTED",
    });
    expect(await sa.saveSelfAssessmentProfile(raw, { name: "Nama Lain", position: "Jabatan Lain" }, meta)).toMatchObject({ code: "SELF_ASSESSMENT_SUBMITTED" });
    expect(await sa.submitSelfAssessment(raw, meta)).toMatchObject({ code: "SELF_ASSESSMENT_SUBMITTED" });
    expect(await sa.resolveSelfAssessmentToken(raw)).toMatchObject({ state: "SUBMITTED" });
    await expect(sa.revokeSelfAssessment(actor, id, meta)).rejects.toMatchObject({ code: "SELF_ASSESSMENT_SUBMITTED" });
    await expect(sa.reissueSelfAssessment(actor, id, meta)).rejects.toMatchObject({ code: "SELF_ASSESSMENT_SUBMITTED" });

    const detail = await sa.loadSelfAssessmentDetail(assessmentId, id);
    expect(detail?.rows.map((r) => r.level)).toEqual([4, 3, 3]);
    expect(detail?.rows[0]?.evidence.map((e) => e.title)).toEqual(["Notulen rapat keselamatan"]);
  });
});

describe("pencabutan dan penerbitan ulang", () => {
  it("tautan lama tidak berlaku, tautan baru melanjutkan draf yang sama", async () => {
    const issued = await sa.issueSelfAssessment(actor, { name: "Agus", position: "Manajer Proyek", unitId }, meta);
    const oldRaw = tokenOf(issued.link);
    await sa.saveSelfAssessmentAnswer(oldRaw, { characteristicId: characteristics[0]!.id, statementId: characteristics[0]!.statements[0]!.id, justification: REASON, evidenceIds: [] }, meta);

    await sa.revokeSelfAssessment(actor, issued.id, meta);
    expect(await sa.resolveSelfAssessmentToken(oldRaw)).toEqual({ state: "INVALID" });
    expect(await sa.saveSelfAssessmentProfile(oldRaw, { name: "Agus", position: "Manajer" }, meta)).toMatchObject({ status: 404, code: "INVALID_TOKEN" });
    await expect(sa.revokeSelfAssessment(actor, issued.id, meta)).rejects.toMatchObject({ code: "NO_ACTIVE_TOKEN" });

    const { link } = await sa.reissueSelfAssessment(actor, issued.id, meta);
    const access = await sa.resolveSelfAssessmentToken(tokenOf(link));
    expect(access).toMatchObject({ state: "READY", selfAssessmentId: issued.id });
    if (access.state !== "READY") return;
    const form = await sa.loadSelfAssessmentForm(access);
    expect(form.characteristics[0]?.answer.justification).toBe(REASON);
  });

  it("setelah pengumpulan data ditutup, tautan tidak dapat dipakai untuk mengubah jawaban", async () => {
    const issued = await sa.issueSelfAssessment(actor, { name: "Dewi", position: "Kepala Divisi", unitId }, meta);
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "SCORING" } });
    expect(await sa.resolveSelfAssessmentToken(tokenOf(issued.link))).toEqual({ state: "CLOSED" });
    expect(await sa.saveSelfAssessmentProfile(tokenOf(issued.link), { name: "Dewi", position: "Kepala" }, meta)).toMatchObject({ code: "DISTRIBUTION_CLOSED" });
    await db.assessment.update({ where: { id: assessmentId }, data: { status: "DATA_COLLECTION" } });
  });
});
