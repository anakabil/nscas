import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/mail";
import { hashToken, looksLikeToken, selfAssessmentLink } from "@/lib/privacy/tokens";
import { createAccessToken } from "@/lib/respondents/service";
import { respondentOrder } from "@/lib/survey/rules";
import { missingForSubmit, type AnswerDraft, type MissingReason } from "./rules";

// Penilaian mandiri manajemen (docs/01 M4) pada rute /sa/[token]. Tidak anonim: nama dan jabatan pengisi
// tersimpan bersama jawaban, draf disimpan di server, dan setiap perubahan dicatat di jejak audit
// (CLAUDE.md aturan 6). Pengisi tidak memiliki akun, sehingga pelaku di jejak audit kosong dan identitasnya
// adalah SelfAssessment yang diubah.

type Tx = Prisma.TransactionClient;

/** Penilaian mandiri dapat diterbitkan dan diisi setelah konfigurasi dikunci sampai pengumpulan data ditutup. */
const OPEN_STATUSES: readonly AssessmentStatus[] = ["LOCKED", "DATA_COLLECTION"];

export interface SelfAssessmentActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
}

const actorOf = (a: SelfAssessmentActor) => ({ id: a.session.user.id, role: a.roles[0] ?? null });

async function lockOpenAssessment(tx: Tx, assessmentId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`SELECT "status" FROM "Assessment" WHERE "id" = ${assessmentId} FOR UPDATE`;
  const status = rows[0]?.status;
  if (!status) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (!OPEN_STATUSES.includes(status)) throw new AssessmentRuleError(409, "DISTRIBUTION_CLOSED", { status });
}

// ---------------------------------------------------------------------------
// Konsol: penerbitan, daftar, pencabutan, penerbitan ulang
// ---------------------------------------------------------------------------

export async function issueSelfAssessment(
  actor: SelfAssessmentActor,
  input: { name: string; position: string; unitId: string },
  meta: RequestMeta,
): Promise<{ id: string; link: string }> {
  const base = appUrl();
  return getDb().$transaction(async (tx) => {
    await lockOpenAssessment(tx, actor.assessmentId);
    const unit = await tx.unit.findFirst({ where: { id: input.unitId, assessmentId: actor.assessmentId }, select: { id: true } });
    if (!unit) throw new AssessmentRuleError(404, "NOT_FOUND");
    const token = await createAccessToken(tx, {
      assessmentId: actor.assessmentId,
      unitId: unit.id,
      stratumId: null,
      rosterEntryId: null,
      kind: "SELF_ASSESSMENT",
      channel: "LINK",
    });
    const sa = await tx.selfAssessment.create({
      data: { assessmentId: actor.assessmentId, accessTokenId: token.id, respondentName: input.name, respondentPosition: input.position },
      select: { id: true },
    });
    await logAudit(tx, {
      action: "selfAssessment.issue",
      entityType: "SelfAssessment",
      entityId: sa.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: { respondentName: input.name, respondentPosition: input.position, unitId: unit.id },
      meta,
    });
    return { id: sa.id, link: selfAssessmentLink(base, token.raw) };
  });
}

export async function listSelfAssessments(assessmentId: string) {
  const rows = await getDb().selfAssessment.findMany({
    where: { assessmentId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      respondentName: true,
      respondentPosition: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      accessToken: { select: { revokedAt: true, firstOpenedAt: true, unit: { select: { name: true } } } },
      answers: { select: { level: true, justification: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.respondentName,
    position: r.respondentPosition,
    unitName: r.accessToken.unit.name,
    status: r.status,
    submittedAt: r.submittedAt,
    issuedAt: r.createdAt,
    revoked: r.accessToken.revokedAt !== null,
    opened: r.accessToken.firstOpenedAt !== null,
    answered: r.answers.filter((a) => a.level !== null).length,
  }));
}

async function loadForChange(tx: Tx, actor: SelfAssessmentActor, selfAssessmentId: string) {
  await lockOpenAssessment(tx, actor.assessmentId);
  const sa = await tx.selfAssessment.findFirst({
    where: { id: selfAssessmentId, assessmentId: actor.assessmentId },
    select: { id: true, status: true, accessTokenId: true, accessToken: { select: { unitId: true, revokedAt: true } } },
  });
  if (!sa) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (sa.status === "SUBMITTED") throw new AssessmentRuleError(409, "SELF_ASSESSMENT_SUBMITTED");
  return sa;
}

export async function revokeSelfAssessment(actor: SelfAssessmentActor, selfAssessmentId: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const sa = await loadForChange(tx, actor, selfAssessmentId);
    if (sa.accessToken.revokedAt) throw new AssessmentRuleError(422, "NO_ACTIVE_TOKEN");
    await tx.accessToken.update({ where: { id: sa.accessTokenId }, data: { revokedAt: new Date(), revokedReason: "MANUAL" } });
    await logAudit(tx, {
      action: "selfAssessment.revoke",
      entityType: "SelfAssessment",
      entityId: sa.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      meta,
    });
  });
}

/** Tautan baru menggantikan tautan lama; draf yang sudah diisi tetap tersimpan. */
export async function reissueSelfAssessment(actor: SelfAssessmentActor, selfAssessmentId: string, meta: RequestMeta): Promise<{ link: string }> {
  const base = appUrl();
  return getDb().$transaction(async (tx) => {
    const sa = await loadForChange(tx, actor, selfAssessmentId);
    if (!sa.accessToken.revokedAt) {
      await tx.accessToken.update({ where: { id: sa.accessTokenId }, data: { revokedAt: new Date(), revokedReason: "REISSUED" } });
    }
    const token = await createAccessToken(tx, {
      assessmentId: actor.assessmentId,
      unitId: sa.accessToken.unitId,
      stratumId: null,
      rosterEntryId: null,
      kind: "SELF_ASSESSMENT",
      channel: "LINK",
    });
    await tx.selfAssessment.update({ where: { id: sa.id }, data: { accessTokenId: token.id } });
    await logAudit(tx, {
      action: "selfAssessment.reissue",
      entityType: "SelfAssessment",
      entityId: sa.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      meta,
    });
    return { link: selfAssessmentLink(base, token.raw) };
  });
}

/** Rincian jawaban untuk konsol (asesor dan administrator klien). */
export async function loadSelfAssessmentDetail(assessmentId: string, selfAssessmentId: string) {
  const sa = await getDb().selfAssessment.findFirst({
    where: { id: selfAssessmentId, assessmentId },
    select: {
      id: true,
      respondentName: true,
      respondentPosition: true,
      status: true,
      submittedAt: true,
      accessToken: { select: { unit: { select: { name: true } } } },
      assessment: { select: { instrumentVersionId: true } },
      answers: { select: { characteristicId: true, level: true, justification: true, evidenceIds: true } },
    },
  });
  if (!sa) return null;
  const [characteristics, evidence] = await Promise.all([
    getDb().characteristic.findMany({
      where: { instrumentVersionId: sa.assessment.instrumentVersionId },
      orderBy: { order: "asc" },
      select: { id: true, code: true, nameId: true, levelStatements: { select: { level: true, textId: true } } },
    }),
    getDb().evidenceItem.findMany({
      where: { id: { in: sa.answers.flatMap((a) => a.evidenceIds) }, assessmentId },
      select: { id: true, title: true, version: true, deletedAt: true },
    }),
  ]);
  const answers = new Map(sa.answers.map((a) => [a.characteristicId, a]));
  return {
    ...sa,
    unitName: sa.accessToken.unit.name,
    rows: characteristics.map((c) => {
      const a = answers.get(c.id);
      return {
        code: c.code,
        name: c.nameId,
        level: a?.level ?? null,
        statement: c.levelStatements.find((s) => s.level === a?.level)?.textId ?? null,
        justification: a?.justification ?? null,
        evidence: evidence.filter((e) => a?.evidenceIds.includes(e.id)),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Rute bertoken /sa/[token]
// ---------------------------------------------------------------------------

export type SelfAssessmentAccess =
  | { state: "INVALID" }
  | { state: "CLOSED" }
  | { state: "READY" | "SUBMITTED"; tokenHash: string; selfAssessmentId: string; assessmentId: string };

export async function resolveSelfAssessmentToken(raw: string): Promise<SelfAssessmentAccess> {
  if (!looksLikeToken(raw)) return { state: "INVALID" };
  const tokenHash = hashToken(raw);
  const token = await getDb().accessToken.findUnique({
    where: { tokenHash },
    select: { kind: true, revokedAt: true, selfAssessment: { select: { id: true, status: true } }, assessment: { select: { id: true, status: true } } },
  });
  if (!token || token.kind !== "SELF_ASSESSMENT" || token.revokedAt || !token.selfAssessment) return { state: "INVALID" };
  const base = { tokenHash, selfAssessmentId: token.selfAssessment.id, assessmentId: token.assessment.id };
  if (token.selfAssessment.status === "SUBMITTED") return { state: "SUBMITTED", ...base };
  if (!OPEN_STATUSES.includes(token.assessment.status)) return { state: "CLOSED" };
  return { state: "READY", ...base };
}

export async function loadSelfAssessmentForm(access: Extract<SelfAssessmentAccess, { tokenHash: string }>) {
  const db = getDb();
  const sa = await db.selfAssessment.findUniqueOrThrow({
    where: { id: access.selfAssessmentId },
    select: {
      respondentName: true,
      respondentPosition: true,
      status: true,
      submittedAt: true,
      assessment: { select: { instrumentVersionId: true, organization: { select: { name: true } } } },
      answers: { select: { characteristicId: true, level: true, justification: true, evidenceIds: true } },
    },
  });
  const [characteristics, evidence] = await Promise.all([
    db.characteristic.findMany({
      where: { instrumentVersionId: sa.assessment.instrumentVersionId },
      orderBy: { order: "asc" },
      select: { id: true, code: true, nameId: true, nameEn: true, levelStatements: { select: { id: true, level: true, textId: true, textEn: true } } },
    }),
    // Hanya versi terbaru yang belum dihapus.
    db.evidenceItem.findMany({
      where: { assessmentId: access.assessmentId, deletedAt: null, supersededBy: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true, version: true, links: { select: { characteristicId: true } } },
    }),
  ]);
  const answers = new Map(sa.answers.map((a) => [a.characteristicId, a]));
  return {
    organizationName: sa.assessment.organization.name,
    profile: { name: sa.respondentName, position: sa.respondentPosition },
    status: sa.status,
    submittedAt: sa.submittedAt,
    evidence: evidence.map((e) => ({ id: e.id, title: e.title, version: e.version, characteristicIds: e.links.map((l) => l.characteristicId) })),
    characteristics: characteristics.map((c) => {
      const a = answers.get(c.id);
      return {
        id: c.id,
        code: c.code,
        name: { id: c.nameId, en: c.nameEn },
        // Urutan acak tetap per tautan dan tanpa nomor tingkat, seperti survei, agar tidak menggiring jawaban.
        statements: respondentOrder(c.levelStatements, access.tokenHash).map((s) => ({ id: s.id, text: { id: s.textId, en: s.textEn } })),
        answer: {
          statementId: c.levelStatements.find((s) => s.level === a?.level)?.id ?? null,
          justification: a?.justification ?? "",
          evidenceIds: a?.evidenceIds ?? [],
        },
      };
    }),
  };
}

export type TokenChangeResult =
  | { ok: true }
  | { ok: false; status: 404 | 409 | 422; code: string; missing?: { characteristicId: string; reasons: MissingReason[] }[] };

type LockFailure = { ok: false; status: 404 | 409; code: "INVALID_TOKEN" | "SELF_ASSESSMENT_SUBMITTED" | "DISTRIBUTION_CLOSED" };

/** Mengunci penilaian mandiri milik token untuk diubah; menolak bila token tidak sah, sudah dikirim, atau ditutup. */
async function lockByToken(tx: Tx, raw: string): Promise<
  | { error: LockFailure }
  | {
      error: null;
      token: { id: string };
      selfAssessmentId: string;
      assessmentId: string;
      organizationId: string;
      instrumentVersionId: string;
    }
> {
  if (!looksLikeToken(raw)) return { error: { ok: false, status: 404, code: "INVALID_TOKEN" } as const };
  const token = await tx.accessToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { id: true, kind: true, revokedAt: true, firstOpenedAt: true, selfAssessment: { select: { id: true } }, assessment: { select: { id: true, organizationId: true } } },
  });
  if (!token || token.kind !== "SELF_ASSESSMENT" || token.revokedAt || !token.selfAssessment) {
    return { error: { ok: false, status: 404, code: "INVALID_TOKEN" } as const };
  }
  const rows = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "SelfAssessment" WHERE "id" = ${token.selfAssessment.id} FOR UPDATE`;
  if (rows[0]?.status === "SUBMITTED") return { error: { ok: false, status: 409, code: "SELF_ASSESSMENT_SUBMITTED" } as const };
  const assessment = await tx.assessment.findUniqueOrThrow({ where: { id: token.assessment.id }, select: { status: true, instrumentVersionId: true } });
  if (!OPEN_STATUSES.includes(assessment.status)) return { error: { ok: false, status: 409, code: "DISTRIBUTION_CLOSED" } as const };
  if (!token.firstOpenedAt) await tx.accessToken.update({ where: { id: token.id }, data: { firstOpenedAt: new Date() } });
  return {
    error: null,
    token,
    selfAssessmentId: token.selfAssessment.id,
    assessmentId: token.assessment.id,
    organizationId: token.assessment.organizationId,
    instrumentVersionId: assessment.instrumentVersionId,
  };
}

function auditBase(ctx: { selfAssessmentId: string; organizationId: string; assessmentId: string }, meta: RequestMeta) {
  return {
    entityType: "SelfAssessment",
    entityId: ctx.selfAssessmentId,
    actor: { id: null },
    organizationId: ctx.organizationId,
    assessmentId: ctx.assessmentId,
    meta,
  };
}

export async function saveSelfAssessmentProfile(raw: string, input: { name: string; position: string }, meta: RequestMeta): Promise<TokenChangeResult> {
  return getDb().$transaction(async (tx): Promise<TokenChangeResult> => {
    const ctx = await lockByToken(tx, raw);
    if (ctx.error) return ctx.error;
    const before = await tx.selfAssessment.findUniqueOrThrow({ where: { id: ctx.selfAssessmentId }, select: { respondentName: true, respondentPosition: true } });
    await tx.selfAssessment.update({ where: { id: ctx.selfAssessmentId }, data: { respondentName: input.name, respondentPosition: input.position } });
    await logAudit(tx, {
      action: "selfAssessment.profile_update",
      ...auditBase(ctx, meta),
      before: { respondentName: before.respondentName, respondentPosition: before.respondentPosition },
      after: { respondentName: input.name, respondentPosition: input.position },
    });
    return { ok: true };
  });
}

export async function saveSelfAssessmentAnswer(raw: string, input: AnswerDraft, meta: RequestMeta): Promise<TokenChangeResult> {
  return getDb().$transaction(async (tx): Promise<TokenChangeResult> => {
    const ctx = await lockByToken(tx, raw);
    if (ctx.error) return ctx.error;
    const characteristic = await tx.characteristic.findFirst({
      where: { id: input.characteristicId, instrumentVersionId: ctx.instrumentVersionId },
      select: { id: true, code: true, levelStatements: { select: { id: true, level: true } } },
    });
    if (!characteristic) return { ok: false, status: 422, code: "UNKNOWN_ITEM" };
    let level: number | null = null;
    if (input.statementId) {
      const statement = characteristic.levelStatements.find((s) => s.id === input.statementId);
      if (!statement) return { ok: false, status: 422, code: "UNKNOWN_ITEM" };
      level = statement.level;
    }
    if (input.evidenceIds.length > 0) {
      const found = await tx.evidenceItem.count({ where: { id: { in: input.evidenceIds }, assessmentId: ctx.assessmentId, deletedAt: null } });
      if (found !== input.evidenceIds.length) return { ok: false, status: 422, code: "UNKNOWN_EVIDENCE" };
    }
    const where = { selfAssessmentId_characteristicId: { selfAssessmentId: ctx.selfAssessmentId, characteristicId: characteristic.id } };
    const before = await tx.selfAssessmentAnswer.findUnique({ where, select: { level: true, justification: true, evidenceIds: true } });
    const data = { level, justification: input.justification, evidenceIds: input.evidenceIds };
    await tx.selfAssessmentAnswer.upsert({ where, create: { selfAssessmentId: ctx.selfAssessmentId, characteristicId: characteristic.id, ...data }, update: data });
    await logAudit(tx, {
      action: "selfAssessment.answer_save",
      ...auditBase(ctx, meta),
      before: before ? { characteristic: characteristic.code, ...before } : null,
      after: { characteristic: characteristic.code, ...data },
    });
    return { ok: true };
  });
}

/** Mengirim penilaian mandiri. Setelah SUBMITTED, jawaban terkunci (docs/01 M4). */
export async function submitSelfAssessment(raw: string, meta: RequestMeta): Promise<TokenChangeResult> {
  return getDb().$transaction(async (tx): Promise<TokenChangeResult> => {
    const ctx = await lockByToken(tx, raw);
    if (ctx.error) return ctx.error;
    const characteristics = await tx.characteristic.findMany({ where: { instrumentVersionId: ctx.instrumentVersionId }, orderBy: { order: "asc" }, select: { id: true } });
    const answers = await tx.selfAssessmentAnswer.findMany({
      where: { selfAssessmentId: ctx.selfAssessmentId },
      select: { characteristicId: true, level: true, justification: true },
    });
    const missing = missingForSubmit(
      characteristics.map((c) => c.id),
      answers,
    );
    if (missing.length > 0) return { ok: false, status: 422, code: "INCOMPLETE", missing };
    const now = new Date();
    await tx.selfAssessment.update({ where: { id: ctx.selfAssessmentId }, data: { status: "SUBMITTED", submittedAt: now } });
    await tx.accessToken.update({ where: { id: ctx.token.id }, data: { completedAt: now } });
    await logAudit(tx, { action: "selfAssessment.submit", ...auditBase(ctx, meta), after: { status: "SUBMITTED", answers: answers.length } });
    return { ok: true };
  });
}
