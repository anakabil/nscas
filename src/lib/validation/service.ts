import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role, StratumGroup, ValidationSessionType } from "@/generated/prisma/enums";
import { loadEffectiveParameters } from "@/lib/assessments/load";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import guideBank from "../../../seed/panduan-validasi-v1.json";
import { isValidRating, proposeSessions, type Proposal } from "./proposal";

// Validasi daring (docs/01 M7): penjadwalan wawancara, diskusi kelompok terarah, dan kunjungan virtual dengan
// tautan rapat eksternal; panduan pertanyaan per lapisan jabatan; nilai asesor per sesi. Daftar narasumber
// disimpan terpisah dari catatan dan nilai, sehingga pernyataan dalam catatan tidak dikaitkan ke nama.

type Tx = Prisma.TransactionClient;

export interface ValidationActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
}

const actorOf = (a: ValidationActor) => ({ id: a.session.user.id, role: a.roles[0] ?? null });
const SCHEDULE_STATUSES: readonly AssessmentStatus[] = ["LOCKED", "DATA_COLLECTION", "SCORING"];
/** Nilai validasi masuk ke mesin penilaian; setelah rapat panel dimulai, nilai tidak dapat diubah lagi. */
const RATING_STATUSES: readonly AssessmentStatus[] = ["DATA_COLLECTION", "SCORING"];
const LAYERS: readonly StratumGroup[] = ["MANAGEMENT", "SUPERVISORY", "FIELD"];

async function assertStatus(tx: Pick<Tx, "assessment">, assessmentId: string, allowed: readonly AssessmentStatus[], code = "VALIDATION_CLOSED") {
  const a = await tx.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { status: true } });
  if (!allowed.includes(a.status)) throw new AssessmentRuleError(409, code, { status: a.status });
}

function audit(actor: ValidationActor, entry: { action: Parameters<typeof logAudit>[1]["action"]; entityType: string; entityId: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }, meta: RequestMeta) {
  return { ...entry, actor: actorOf(actor), organizationId: actor.organizationId, assessmentId: actor.assessmentId, meta };
}

// ---------------------------------------------------------------------------
// Templat panduan pertanyaan
// ---------------------------------------------------------------------------

export interface GuideQuestion {
  characteristicCode: string;
  question: string;
}

const bank = guideBank as { opening: string; layers: Record<StratumGroup, string>; questions: Record<string, string> };

/** Templat bawaan dari seed/panduan-validasi-v1.json, satu contoh pertanyaan per karakteristik instrumen. */
export function defaultGuide(layer: StratumGroup, characteristicCodes: readonly string[]): { intro: string; questions: GuideQuestion[] } {
  return {
    intro: `${bank.layers[layer]}\n\n${bank.opening}`,
    questions: characteristicCodes.map((code) => ({ characteristicCode: code, question: bank.questions[code] ?? "" })),
  };
}

/** Membuat templat ketiga lapisan untuk asesmen bila belum ada. */
export async function ensureGuideTemplates(tx: Tx, assessmentId: string): Promise<void> {
  const existing = await tx.validationGuideTemplate.findMany({ where: { assessmentId }, select: { layer: true } });
  const missing = LAYERS.filter((l) => !existing.some((e) => e.layer === l));
  if (missing.length === 0) return;
  const { instrumentVersionId } = await tx.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { instrumentVersionId: true } });
  const codes = (await tx.characteristic.findMany({ where: { instrumentVersionId }, orderBy: { order: "asc" }, select: { code: true } })).map((c) => c.code);
  for (const layer of missing) {
    const guide = defaultGuide(layer, codes);
    await tx.validationGuideTemplate.create({ data: { assessmentId, layer, intro: guide.intro, questions: guide.questions as unknown as Prisma.InputJsonArray } });
  }
}

export async function loadGuideTemplates(assessmentId: string) {
  await getDb().$transaction((tx) => ensureGuideTemplates(tx, assessmentId));
  const templates = await getDb().validationGuideTemplate.findMany({ where: { assessmentId }, select: { id: true, layer: true, intro: true, questions: true, updatedAt: true } });
  return LAYERS.map((layer) => {
    const t = templates.find((x) => x.layer === layer) as (typeof templates)[number];
    return { ...t, questions: t.questions as unknown as GuideQuestion[] };
  });
}

export const guideSchema = z.object({
  layer: z.enum(["MANAGEMENT", "SUPERVISORY", "FIELD"]),
  intro: z.string().trim().min(1).max(5000),
  questions: z.array(z.object({ characteristicCode: z.string().min(1).max(20), question: z.string().trim().max(1000) })).max(100),
});

export async function updateGuideTemplate(actor: ValidationActor, input: z.output<typeof guideSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await assertStatus(tx, actor.assessmentId, SCHEDULE_STATUSES);
    await ensureGuideTemplates(tx, actor.assessmentId);
    const before = await tx.validationGuideTemplate.findUniqueOrThrow({ where: { assessmentId_layer: { assessmentId: actor.assessmentId, layer: input.layer } } });
    const codes = new Set((before.questions as unknown as GuideQuestion[]).map((q) => q.characteristicCode));
    if (input.questions.some((q) => !codes.has(q.characteristicCode))) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");
    await tx.validationGuideTemplate.update({
      where: { id: before.id },
      data: { intro: input.intro, questions: input.questions as unknown as Prisma.InputJsonArray, updatedById: actor.session.user.id },
    });
    await logAudit(
      tx,
      audit(actor, { action: "validation.guide_update", entityType: "ValidationGuideTemplate", entityId: before.id, before: { intro: before.intro, questions: before.questions }, after: input }, meta),
    );
  });
}

// ---------------------------------------------------------------------------
// Usulan dan penjadwalan sesi
// ---------------------------------------------------------------------------

export async function loadProposal(assessmentId: string): Promise<(Proposal & { available: true }) | { available: false }> {
  const { parameters } = await loadEffectiveParameters(assessmentId);
  const plan = parameters.samplePlan?.result;
  if (!plan) return { available: false };
  const strata = await getDb().stratum.findMany({ where: { assessmentId }, orderBy: { code: "asc" }, select: { id: true, code: true, group: true, population: true } });
  return {
    available: true,
    ...proposeSessions({
      interviewsManagement: plan.sclMinimumInterviewManagement,
      interviewsOperational: plan.sclMinimumInterviewOperational,
      projectsToVisit: plan.projectsToVisit,
      strata,
      maxParticipantsPerSession: parameters.sampling?.fgdMaxParticipantsPerSession ?? 8,
    }),
  };
}

/**
 * Membuat sesi dari usulan (belum dijadwalkan). Ditolak bila asesmen sudah memiliki sesi, agar tidak terduplikasi.
 * Nama sesi disusun pemanggil dari teks antarmuka (next-intl).
 */
export async function createSessionsFromProposal(
  actor: ValidationActor,
  labelFor: (session: { type: ValidationSessionType; stratumCode: string | null; sequence: number }) => string,
  meta: RequestMeta,
): Promise<number> {
  const proposal = await loadProposal(actor.assessmentId);
  if (!proposal.available) throw new AssessmentRuleError(409, "SAMPLE_PLAN_MISSING");
  return getDb().$transaction(async (tx) => {
    await assertStatus(tx, actor.assessmentId, SCHEDULE_STATUSES);
    await tx.$queryRaw`SELECT "id" FROM "Assessment" WHERE "id" = ${actor.assessmentId} FOR UPDATE`;
    if ((await tx.validationSession.count({ where: { assessmentId: actor.assessmentId } })) > 0) throw new AssessmentRuleError(409, "SESSIONS_EXIST");
    await ensureGuideTemplates(tx, actor.assessmentId);
    const templates = await tx.validationGuideTemplate.findMany({ where: { assessmentId: actor.assessmentId }, select: { id: true, layer: true } });
    await tx.validationSession.createMany({
      data: proposal.sessions.map((s) => ({
        assessmentId: actor.assessmentId,
        type: s.type,
        label: labelFor(s),
        stratumId: s.stratumId,
        participantCount: s.participantCount || null,
        guideTemplateId: templates.find((t) => t.layer === s.layer)?.id ?? null,
      })),
    });
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "validation.sessions_proposed",
          entityType: "Assessment",
          entityId: actor.assessmentId,
          after: { interviews: proposal.interviews, focusGroups: proposal.focusGroups, virtualVisits: proposal.virtualVisits, sessions: proposal.sessions.length },
        },
        meta,
      ),
    );
    return proposal.sessions.length;
  });
}

/** Tautan rapat eksternal (Zoom, Google Meet, Microsoft Teams, atau layanan lain) wajib HTTPS. */
const meetingUrl = z
  .union([z.literal(""), z.url({ protocol: /^https$/ }).max(500)])
  .nullish()
  .transform((v) => v || null);

/** Isian datetime-local dibaca sebagai waktu WIB (UTC+7). */
const wibDateTime = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)])
  .nullish()
  .transform((v) => (v ? new Date(`${v}:00+07:00`) : null));

export const sessionSchema = z.object({
  type: z.enum(["INTERVIEW", "FOCUS_GROUP", "VIRTUAL_SITE_VISIT"]),
  label: z.string().trim().min(2).max(200),
  unitId: z.string().max(64).nullish().transform((v) => v || null),
  stratumId: z.string().max(64).nullish().transform((v) => v || null),
  scheduledAt: wibDateTime,
  meetingUrl,
  participantCount: z.union([z.literal(""), z.coerce.number().int().min(0).max(50)]).nullish().transform((v) => (v === "" || v === undefined ? null : v)),
  guideLayer: z.enum(["MANAGEMENT", "SUPERVISORY", "FIELD"]),
});

/** Jadwal sesi, diubah asesor utama. */
export const sessionUpdateSchema = sessionSchema.omit({ type: true }).extend({
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
});

async function resolveRefs(tx: Tx, actor: ValidationActor, input: { unitId: string | null; stratumId: string | null; guideLayer: StratumGroup }) {
  if (input.unitId && !(await tx.unit.findFirst({ where: { id: input.unitId, assessmentId: actor.assessmentId }, select: { id: true } }))) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (input.stratumId && !(await tx.stratum.findFirst({ where: { id: input.stratumId, assessmentId: actor.assessmentId }, select: { id: true } }))) throw new AssessmentRuleError(404, "NOT_FOUND");
  await ensureGuideTemplates(tx, actor.assessmentId);
  return (await tx.validationGuideTemplate.findUniqueOrThrow({ where: { assessmentId_layer: { assessmentId: actor.assessmentId, layer: input.guideLayer } }, select: { id: true } })).id;
}

export async function createSession(actor: ValidationActor, input: z.output<typeof sessionSchema>, meta: RequestMeta): Promise<{ id: string }> {
  return getDb().$transaction(async (tx) => {
    await assertStatus(tx, actor.assessmentId, SCHEDULE_STATUSES);
    const guideTemplateId = await resolveRefs(tx, actor, input);
    const session = await tx.validationSession.create({
      data: {
        assessmentId: actor.assessmentId,
        type: input.type,
        label: input.label,
        unitId: input.unitId,
        stratumId: input.stratumId,
        scheduledAt: input.scheduledAt,
        meetingUrl: input.meetingUrl,
        participantCount: input.participantCount,
        guideTemplateId,
      },
      select: { id: true },
    });
    await logAudit(tx, audit(actor, { action: "validation.session_create", entityType: "ValidationSession", entityId: session.id, after: { ...input, scheduledAt: input.scheduledAt?.toISOString() ?? null } }, meta));
    return session;
  });
}

export async function updateSession(actor: ValidationActor, sessionId: string, input: z.output<typeof sessionUpdateSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await assertStatus(tx, actor.assessmentId, SCHEDULE_STATUSES);
    const before = await tx.validationSession.findFirst({ where: { id: sessionId, assessmentId: actor.assessmentId } });
    if (!before) throw new AssessmentRuleError(404, "NOT_FOUND");
    const guideTemplateId = await resolveRefs(tx, actor, input);
    const data = {
      label: input.label,
      unitId: input.unitId,
      stratumId: input.stratumId,
      scheduledAt: input.scheduledAt,
      meetingUrl: input.meetingUrl,
      participantCount: input.participantCount,
      guideTemplateId,
      status: input.status,
    };
    await tx.validationSession.update({ where: { id: sessionId }, data });
    const pick = (s: typeof before | typeof data) => ({
      label: s.label,
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
      meetingUrl: s.meetingUrl,
      participantCount: s.participantCount,
      status: s.status,
    });
    await logAudit(tx, audit(actor, { action: "validation.session_update", entityType: "ValidationSession", entityId: sessionId, before: pick(before), after: pick(data) }, meta));
  });
}

export async function listSessions(assessmentId: string) {
  return getDb().validationSession.findMany({
    where: { assessmentId },
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { type: "asc" }, { label: "asc" }],
    select: {
      id: true,
      type: true,
      label: true,
      scheduledAt: true,
      meetingUrl: true,
      status: true,
      participantCount: true,
      recordingConsent: true,
      unit: { select: { name: true } },
      stratum: { select: { code: true, name: true } },
      _count: { select: { participants: true, ratings: true } },
    },
  });
}

export async function loadSession(assessmentId: string, sessionId: string, assessorId: string) {
  const session = await getDb().validationSession.findFirst({
    where: { id: sessionId, assessmentId },
    select: {
      id: true,
      type: true,
      label: true,
      unitId: true,
      stratumId: true,
      scheduledAt: true,
      meetingUrl: true,
      status: true,
      participantCount: true,
      recordingConsent: true,
      notes: true,
      guideTemplate: { select: { layer: true, intro: true, questions: true } },
      unit: { select: { name: true } },
      stratum: { select: { code: true, name: true } },
      assessment: { select: { status: true, instrumentVersionId: true } },
      participants: { orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, position: true } },
      // Formulir menampilkan nilai milik asesor yang sedang masuk saja.
      ratings: { where: { assessorId }, select: { characteristicId: true, level: true, note: true } },
      _count: { select: { ratings: true } },
    },
  });
  if (!session) return null;
  const characteristics = await getDb().characteristic.findMany({
    where: { instrumentVersionId: session.assessment.instrumentVersionId },
    orderBy: { order: "asc" },
    select: { id: true, code: true, nameId: true },
  });
  return { ...session, characteristics, guideQuestions: (session.guideTemplate?.questions as unknown as GuideQuestion[] | undefined) ?? [] };
}

// ---------------------------------------------------------------------------
// Narasumber (terpisah dari catatan) dan nilai asesor
// ---------------------------------------------------------------------------

export const participantSchema = z.object({ fullName: z.string().trim().min(2).max(200), position: z.string().trim().min(2).max(200) });

export async function addParticipant(actor: ValidationActor, sessionId: string, input: z.output<typeof participantSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await assertStatus(tx, actor.assessmentId, SCHEDULE_STATUSES);
    const session = await tx.validationSession.findFirst({ where: { id: sessionId, assessmentId: actor.assessmentId }, select: { id: true } });
    if (!session) throw new AssessmentRuleError(404, "NOT_FOUND");
    const p = await tx.validationParticipant.create({ data: { sessionId, ...input }, select: { id: true } });
    await logAudit(tx, audit(actor, { action: "validation.participant_add", entityType: "ValidationParticipant", entityId: p.id, after: { sessionId, ...input } }, meta));
  });
}

export async function removeParticipant(actor: ValidationActor, participantId: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await assertStatus(tx, actor.assessmentId, SCHEDULE_STATUSES);
    const p = await tx.validationParticipant.findFirst({ where: { id: participantId, session: { assessmentId: actor.assessmentId } }, select: { id: true, sessionId: true, fullName: true, position: true } });
    if (!p) throw new AssessmentRuleError(404, "NOT_FOUND");
    await tx.validationParticipant.delete({ where: { id: p.id } });
    await logAudit(tx, audit(actor, { action: "validation.participant_remove", entityType: "ValidationParticipant", entityId: p.id, before: p }, meta));
  });
}

export const ratingsSchema = z
  .array(
    z.object({
      characteristicId: z.string().min(1).max(64),
      level: z.number().nullable(),
      note: z.string().max(4000).transform((v) => v.trim() || null),
    }),
  )
  .max(100);

export const assessorFormSchema = z.object({
  recordingConsent: z.boolean(),
  notes: z.string().max(10_000).transform((v) => v.trim() || null),
  ratings: ratingsSchema,
});

/**
 * Formulir asesor per sesi (docs/01 M7): nilai 1,0 sampai 5,0 kelipatan 0,5 untuk karakteristik yang dibahas,
 * catatan sesi, dan persetujuan perekaman. Nilai kosong menghapus nilai karakteristik itu. Asesor hanya
 * mengubah nilainya sendiri; catatan dan persetujuan perekaman berlaku untuk sesi.
 */
export async function saveAssessorForm(actor: ValidationActor, sessionId: string, input: z.output<typeof assessorFormSchema>, meta: RequestMeta): Promise<void> {
  const ratings = input.ratings;
  if (ratings.some((r) => r.level !== null && !isValidRating(r.level))) throw new AssessmentRuleError(422, "INVALID_RATING");
  await getDb().$transaction(async (tx) => {
    await assertStatus(tx, actor.assessmentId, RATING_STATUSES, "RATINGS_CLOSED");
    const session = await tx.validationSession.findFirst({
      where: { id: sessionId, assessmentId: actor.assessmentId },
      select: { id: true, notes: true, recordingConsent: true, assessment: { select: { instrumentVersionId: true } } },
    });
    if (!session) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (session.notes !== input.notes || session.recordingConsent !== input.recordingConsent) {
      await tx.validationSession.update({ where: { id: sessionId }, data: { notes: input.notes, recordingConsent: input.recordingConsent } });
      await logAudit(
        tx,
        audit(
          actor,
          {
            action: "validation.session_update",
            entityType: "ValidationSession",
            entityId: sessionId,
            before: { notes: session.notes, recordingConsent: session.recordingConsent },
            after: { notes: input.notes, recordingConsent: input.recordingConsent },
          },
          meta,
        ),
      );
    }
    const valid = await tx.characteristic.findMany({ where: { id: { in: ratings.map((r) => r.characteristicId) }, instrumentVersionId: session.assessment.instrumentVersionId }, select: { id: true, code: true } });
    if (valid.length !== new Set(ratings.map((r) => r.characteristicId)).size) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");
    const assessorId = actor.session.user.id;
    const before = await tx.validationRating.findMany({ where: { sessionId, assessorId }, select: { characteristicId: true, level: true, note: true } });
    for (const r of ratings) {
      const where = { sessionId_characteristicId_assessorId: { sessionId, characteristicId: r.characteristicId, assessorId } };
      if (r.level === null) await tx.validationRating.deleteMany({ where: { sessionId, characteristicId: r.characteristicId, assessorId } });
      else await tx.validationRating.upsert({ where, create: { sessionId, characteristicId: r.characteristicId, assessorId, level: r.level, note: r.note }, update: { level: r.level, note: r.note } });
    }
    const code = (id: string) => valid.find((v) => v.id === id)?.code ?? id;
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "validation.rating_save",
          entityType: "ValidationSession",
          entityId: sessionId,
          before: { ratings: before.map((b) => ({ characteristic: code(b.characteristicId), level: b.level, note: b.note })) },
          after: { ratings: ratings.filter((r) => r.level !== null).map((r) => ({ characteristic: code(r.characteristicId), level: r.level, note: r.note })) },
        },
        meta,
      ),
    );
  });
}
