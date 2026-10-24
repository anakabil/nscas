import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role } from "@/generated/prisma/enums";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { samplePlan } from "@/lib/scoring/sampling";
import { renderConsent } from "./consent";
import {
  applyEdits,
  draftFromDefaults,
  editablePart,
  type DraftParameters,
  type EditableParameters,
} from "./parameters";
import {
  areUnitsEditable,
  evaluateTransition,
  findTransition,
  isConfigurationEditable,
  type TransitionFacts,
} from "./state-machine";
import { wouldCreateCycle } from "./unit-tree";

// Layanan konfigurasi asesmen (docs/01 M1) dan transisi status (docs/01 bagian 3).
// Pemanggil wajib sudah lolos requireRole atau requireOrganizationRole; setiap perubahan dicatat
// di jejak audit dalam transaksi yang sama, setelah baris asesmen dikunci dengan FOR UPDATE.

export class AssessmentRuleError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 422,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = "AssessmentRuleError";
  }
}

type Tx = Prisma.TransactionClient;

export interface AssessmentActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
}

function actorOf(actor: { session: SessionContext; roles: Role[] }) {
  return { id: actor.session.user.id, role: actor.roles[0] ?? null };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Mengunci baris asesmen sampai transaksi selesai dan mengembalikan statusnya saat ini. */
async function lockAssessment(tx: Tx, assessmentId: string): Promise<AssessmentStatus> {
  const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`
    SELECT "status" FROM "Assessment" WHERE "id" = ${assessmentId} FOR UPDATE`;
  if (!rows[0]) throw new AssessmentRuleError(404, "NOT_FOUND");
  return rows[0].status;
}

/** Galat 409 bila konfigurasi sudah dikunci (CLAUDE.md aturan 5). */
async function lockEditableAssessment(tx: Tx, assessmentId: string): Promise<AssessmentStatus> {
  const status = await lockAssessment(tx, assessmentId);
  if (!isConfigurationEditable(status)) throw new AssessmentRuleError(409, "CONFIGURATION_LOCKED", { status });
  return status;
}

/** Draf parameter; bila kosong (asesmen dibuat di luar formulir), parameter bawaan versi instrumennya. */
async function loadDraft(tx: Tx, assessmentId: string): Promise<DraftParameters> {
  const row = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: { parameterDraft: true, instrumentVersion: { select: { defaultParameters: true } } },
  });
  return (row.parameterDraft as unknown as DraftParameters | null) ?? draftFromDefaults(row.instrumentVersion.defaultParameters);
}

async function invalidateSamplePlan(tx: Tx, assessmentId: string): Promise<void> {
  const draft = await loadDraft(tx, assessmentId);
  if (draft.samplePlan) {
    await tx.assessment.update({ where: { id: assessmentId }, data: { parameterDraft: asJson({ ...draft, samplePlan: null }) } });
  }
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(`${s}T00:00:00Z`));

const detailsSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    scopeType: z.enum(["CORPORATE", "DIVISION", "PROJECT"]),
    periodStart: dateString,
    periodEnd: dateString,
    targetLevel: z.coerce.number().int().min(1).max(5),
    instrumentVersionId: z.string().min(1).max(64),
  })
  .refine((d) => d.periodEnd >= d.periodStart, { message: "PERIOD_ORDER", path: ["periodEnd"] });

export type AssessmentDetailsInput = z.input<typeof detailsSchema>;

export function parseAssessmentDetails(input: unknown) {
  return detailsSchema.safeParse(input);
}

// ---------------------------------------------------------------------------
// Pembuatan dan rincian asesmen
// ---------------------------------------------------------------------------

export async function createAssessment(
  actor: { session: SessionContext; organizationId: string; isOperator: boolean; roles: Role[] },
  input: z.output<typeof detailsSchema>,
  meta: RequestMeta,
): Promise<{ id: string }> {
  if (actor.isOperator) throw new AssessmentRuleError(422, "OPERATOR_ORGANIZATION");
  const db = getDb();
  const [organization, version] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: actor.organizationId }, select: { name: true } }),
    db.instrumentVersion.findUnique({ where: { id: input.instrumentVersionId }, select: { id: true, status: true, defaultParameters: true } }),
  ]);
  if (!version || version.status !== "PUBLISHED") throw new AssessmentRuleError(422, "INSTRUMENT_NOT_PUBLISHED");

  const draft = draftFromDefaults(version.defaultParameters);
  const retentionMonths = draft.retention?.rawDataMonths ?? 36;

  return db.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name,
        scopeType: input.scopeType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        targetLevel: input.targetLevel,
        instrumentVersionId: version.id,
        parameterDraft: asJson(draft),
        consentTextId: renderConsent("id", { organizationName: organization.name, retentionMonths }),
        consentTextEn: renderConsent("en", { organizationName: organization.name, retentionMonths }),
      },
      select: { id: true },
    });
    // Lima strata bawaan dari seed; populasi diisi lead assessor.
    await tx.stratum.createMany({
      data: (draft.defaultStrata ?? []).map((s) => ({ assessmentId: assessment.id, code: s.code, name: s.name, group: s.group, isContractor: s.isContractor, population: 0 })),
    });
    // Pembuat asesmen menjadi lead assessor.
    await tx.assessmentAssignment.create({ data: { assessmentId: assessment.id, userId: actor.session.user.id, role: "LEAD_ASSESSOR" } });
    await logAudit(tx, {
      action: "assessment.create",
      entityType: "Assessment",
      entityId: assessment.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: assessment.id,
      after: { ...input, periodStart: input.periodStart.toISOString().slice(0, 10), periodEnd: input.periodEnd.toISOString().slice(0, 10) },
      meta,
    });
    return assessment;
  });
}

export async function updateAssessmentDetails(
  actor: AssessmentActor,
  input: z.output<typeof detailsSchema>,
  meta: RequestMeta,
): Promise<void> {
  const db = getDb();
  await db.$transaction(async (tx) => {
    await lockEditableAssessment(tx, actor.assessmentId);
    const before = await tx.assessment.findUniqueOrThrow({
      where: { id: actor.assessmentId },
      select: { name: true, scopeType: true, periodStart: true, periodEnd: true, targetLevel: true, instrumentVersionId: true },
    });
    const data: Prisma.AssessmentUpdateInput = {
      name: input.name,
      scopeType: input.scopeType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      targetLevel: input.targetLevel,
    };
    // Mengganti versi instrumen mengatur ulang parameter ke bawaan versi tersebut.
    if (input.instrumentVersionId !== before.instrumentVersionId) {
      const version = await tx.instrumentVersion.findUnique({ where: { id: input.instrumentVersionId } });
      if (!version || version.status !== "PUBLISHED") throw new AssessmentRuleError(422, "INSTRUMENT_NOT_PUBLISHED");
      data.instrumentVersion = { connect: { id: version.id } };
      data.parameterDraft = asJson(draftFromDefaults(version.defaultParameters));
    }
    await tx.assessment.update({ where: { id: actor.assessmentId }, data });
    await logAudit(tx, {
      action: "assessment.update",
      entityType: "Assessment",
      entityId: actor.assessmentId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { ...before, periodStart: before.periodStart.toISOString().slice(0, 10), periodEnd: before.periodEnd.toISOString().slice(0, 10) },
      after: { ...input, periodStart: input.periodStart.toISOString().slice(0, 10), periodEnd: input.periodEnd.toISOString().slice(0, 10) },
      meta,
    });
  });
}

// ---------------------------------------------------------------------------
// Unit bertingkat
// ---------------------------------------------------------------------------

const optionalNumber = z
  .union([z.number(), z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : v));

export const unitSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    type: z.enum(["HEAD_OFFICE", "DIVISION", "PROJECT", "BRANCH"]),
    parentId: z.string().max(64).nullish().transform((v) => v || null),
    latitude: optionalNumber.pipe(z.number().min(-90).max(90).nullable()),
    longitude: optionalNumber.pipe(z.number().min(-180).max(180).nullable()),
    radiusMeters: optionalNumber.pipe(z.number().int().min(10).max(10_000).nullable()),
  })
  .transform((u) =>
    // Koordinat dan radius hanya untuk unit berjenis PROJECT (observasi digital, docs/01 M6).
    u.type === "PROJECT" ? u : { ...u, latitude: null, longitude: null, radiusMeters: null },
  )
  .refine((u) => [u.latitude, u.longitude, u.radiusMeters].every((v) => v === null) || [u.latitude, u.longitude, u.radiusMeters].every((v) => v !== null), {
    message: "COORDINATES_INCOMPLETE",
  });

export type UnitInput = z.output<typeof unitSchema>;

async function lockUnitsEditable(tx: Tx, assessmentId: string): Promise<void> {
  const status = await lockAssessment(tx, assessmentId);
  if (!areUnitsEditable(status)) throw new AssessmentRuleError(409, "ASSESSMENT_ARCHIVED", { status });
}

async function assertParent(tx: Tx, assessmentId: string, parentId: string | null): Promise<void> {
  if (!parentId) return;
  const parent = await tx.unit.findUnique({ where: { id: parentId }, select: { assessmentId: true } });
  if (!parent || parent.assessmentId !== assessmentId) throw new AssessmentRuleError(422, "PARENT_NOT_FOUND");
}

export async function createUnit(actor: AssessmentActor, input: UnitInput, meta: RequestMeta): Promise<{ id: string }> {
  return getDb().$transaction(async (tx) => {
    await lockUnitsEditable(tx, actor.assessmentId);
    await assertParent(tx, actor.assessmentId, input.parentId);
    const unit = await tx.unit.create({ data: { ...input, assessmentId: actor.assessmentId }, select: { id: true } });
    await invalidateSamplePlanIfEditable(tx, actor.assessmentId);
    await logAudit(tx, {
      action: "unit.create",
      entityType: "Unit",
      entityId: unit.id,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: input,
      meta,
    });
    return unit;
  });
}

/** Jumlah proyek dan lokasi masuk kalkulator sampel; hasil lama dibatalkan selama konfigurasi belum dikunci. */
async function invalidateSamplePlanIfEditable(tx: Tx, assessmentId: string): Promise<void> {
  const { status } = await tx.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { status: true } });
  if (isConfigurationEditable(status)) await invalidateSamplePlan(tx, assessmentId);
}

export async function updateUnit(actor: AssessmentActor, unitId: string, input: UnitInput, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockUnitsEditable(tx, actor.assessmentId);
    const units = await tx.unit.findMany({ where: { assessmentId: actor.assessmentId }, select: { id: true, parentId: true, name: true } });
    const before = await tx.unit.findFirst({ where: { id: unitId, assessmentId: actor.assessmentId } });
    if (!before) throw new AssessmentRuleError(404, "NOT_FOUND");
    await assertParent(tx, actor.assessmentId, input.parentId);
    if (wouldCreateCycle(units, unitId, input.parentId)) throw new AssessmentRuleError(422, "UNIT_CYCLE");
    await tx.unit.update({ where: { id: unitId }, data: input });
    if (before.type !== input.type) await invalidateSamplePlanIfEditable(tx, actor.assessmentId);
    await logAudit(tx, {
      action: "unit.update",
      entityType: "Unit",
      entityId: unitId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { name: before.name, type: before.type, parentId: before.parentId, latitude: before.latitude, longitude: before.longitude, radiusMeters: before.radiusMeters },
      after: input,
      meta,
    });
  });
}

export async function deleteUnit(actor: AssessmentActor, unitId: string, meta: RequestMeta): Promise<void> {
  try {
    await getDb().$transaction(async (tx) => {
      await lockUnitsEditable(tx, actor.assessmentId);
      const unit = await tx.unit.findFirst({
        where: { id: unitId, assessmentId: actor.assessmentId },
        select: { id: true, name: true, type: true, _count: { select: { children: true } } },
      });
      if (!unit) throw new AssessmentRuleError(404, "NOT_FOUND");
      if (unit._count.children > 0) throw new AssessmentRuleError(422, "UNIT_HAS_CHILDREN");
      await tx.unit.delete({ where: { id: unitId } });
      // Unit yang dihapus dikeluarkan dari cakupan koordinator.
      await tx.$executeRaw`UPDATE "Membership" SET "unitScope" = array_remove("unitScope", ${unitId}) WHERE ${unitId} = ANY("unitScope")`;
      await invalidateSamplePlanIfEditable(tx, actor.assessmentId);
      await logAudit(tx, {
        action: "unit.delete",
        entityType: "Unit",
        entityId: unitId,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        before: { name: unit.name, type: unit.type },
        meta,
      });
    });
  } catch (error) {
    // Unit yang sudah dirujuk responden, token, bukti, atau sesi tidak dapat dihapus.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new AssessmentRuleError(409, "UNIT_IN_USE");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Strata
// ---------------------------------------------------------------------------

export const stratumSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,20}$/),
  name: z.string().trim().min(2).max(200),
  group: z.enum(["MANAGEMENT", "SUPERVISORY", "FIELD"]),
  population: z.coerce.number().int().min(0).max(10_000_000),
  isContractor: z.boolean(),
});

export type StratumInput = z.output<typeof stratumSchema>;

function uniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createStratum(actor: AssessmentActor, input: StratumInput, meta: RequestMeta): Promise<void> {
  try {
    await getDb().$transaction(async (tx) => {
      await lockEditableAssessment(tx, actor.assessmentId);
      const stratum = await tx.stratum.create({ data: { ...input, assessmentId: actor.assessmentId }, select: { id: true } });
      await invalidateSamplePlan(tx, actor.assessmentId);
      await logAudit(tx, {
        action: "stratum.create",
        entityType: "Stratum",
        entityId: stratum.id,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        after: input,
        meta,
      });
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new AssessmentRuleError(422, "STRATUM_CODE_TAKEN");
    throw error;
  }
}

export async function updateStratum(actor: AssessmentActor, stratumId: string, input: StratumInput, meta: RequestMeta): Promise<void> {
  try {
    await getDb().$transaction(async (tx) => {
      await lockEditableAssessment(tx, actor.assessmentId);
      const before = await tx.stratum.findFirst({ where: { id: stratumId, assessmentId: actor.assessmentId } });
      if (!before) throw new AssessmentRuleError(404, "NOT_FOUND");
      await tx.stratum.update({ where: { id: stratumId }, data: input });
      await invalidateSamplePlan(tx, actor.assessmentId);
      await logAudit(tx, {
        action: "stratum.update",
        entityType: "Stratum",
        entityId: stratumId,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        before: { code: before.code, name: before.name, group: before.group, population: before.population, isContractor: before.isContractor },
        after: input,
        meta,
      });
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new AssessmentRuleError(422, "STRATUM_CODE_TAKEN");
    throw error;
  }
}

/** Mengubah populasi beberapa strata sekaligus. */
export async function updateStrataPopulations(actor: AssessmentActor, populations: Record<string, number>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockEditableAssessment(tx, actor.assessmentId);
    const strata = await tx.stratum.findMany({ where: { assessmentId: actor.assessmentId }, select: { id: true, code: true, population: true } });
    const changes = strata.filter((s) => s.id in populations && populations[s.id] !== s.population);
    for (const s of changes) await tx.stratum.update({ where: { id: s.id }, data: { population: populations[s.id] } });
    if (changes.length === 0) return;
    await invalidateSamplePlan(tx, actor.assessmentId);
    await logAudit(tx, {
      action: "stratum.update",
      entityType: "Assessment",
      entityId: actor.assessmentId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: Object.fromEntries(changes.map((s) => [s.code, s.population])),
      after: Object.fromEntries(changes.map((s) => [s.code, populations[s.id]])),
      meta,
    });
  });
}

export async function deleteStratum(actor: AssessmentActor, stratumId: string, meta: RequestMeta): Promise<void> {
  try {
    await getDb().$transaction(async (tx) => {
      await lockEditableAssessment(tx, actor.assessmentId);
      const stratum = await tx.stratum.findFirst({ where: { id: stratumId, assessmentId: actor.assessmentId } });
      if (!stratum) throw new AssessmentRuleError(404, "NOT_FOUND");
      await tx.stratum.delete({ where: { id: stratumId } });
      await invalidateSamplePlan(tx, actor.assessmentId);
      await logAudit(tx, {
        action: "stratum.delete",
        entityType: "Stratum",
        entityId: stratumId,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        before: { code: stratum.code, name: stratum.name, population: stratum.population },
        meta,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new AssessmentRuleError(409, "STRATUM_IN_USE");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Parameter dan kalkulator sampel
// ---------------------------------------------------------------------------

export interface ParameterUpdate {
  parameters: EditableParameters;
  consentTextId: string;
  consentTextEn: string;
  dpaSigned: boolean;
}

export async function updateParameters(actor: AssessmentActor, input: ParameterUpdate, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockEditableAssessment(tx, actor.assessmentId);
    const current = await tx.assessment.findUniqueOrThrow({
      where: { id: actor.assessmentId },
      select: { consentTextId: true, consentTextEn: true, dpaSigned: true },
    });
    const draft = await loadDraft(tx, actor.assessmentId);
    const next = applyEdits(draft, input.parameters);
    await tx.assessment.update({
      where: { id: actor.assessmentId },
      data: {
        parameterDraft: asJson(next),
        consentTextId: input.consentTextId.trim(),
        consentTextEn: input.consentTextEn.trim(),
        dpaSigned: input.dpaSigned,
      },
    });
    await logAudit(tx, {
      action: "assessment.parameters_update",
      entityType: "Assessment",
      entityId: actor.assessmentId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { parameters: editablePart(draft), dpaSigned: current.dpaSigned },
      after: {
        parameters: input.parameters,
        dpaSigned: input.dpaSigned,
        consentTextIdChanged: current.consentTextId !== input.consentTextId.trim(),
        consentTextEnChanged: current.consentTextEn !== input.consentTextEn.trim(),
        samplePlanInvalidated: Boolean(draft.samplePlan) && !next.samplePlan,
      },
      meta,
    });
  });
}

export const samplePlanInputSchema = z.object({
  projects: z.coerce.number().int().min(0).max(10_000),
  locations: z.coerce.number().int().min(0).max(10_000),
});

/** Menjalankan kalkulator sampel di server dari populasi strata di basis data, lalu menyimpan hasilnya di draf. */
export async function saveSamplePlan(
  actor: AssessmentActor,
  input: z.output<typeof samplePlanInputSchema>,
  meta: RequestMeta,
): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockEditableAssessment(tx, actor.assessmentId);
    const draft = await loadDraft(tx, actor.assessmentId);
    const strata = await tx.stratum.findMany({
      where: { assessmentId: actor.assessmentId },
      select: { code: true, name: true, population: true },
      orderBy: { code: "asc" },
    });
    const workers = strata.reduce((sum, s) => sum + s.population, 0);
    if (workers < 1) throw new AssessmentRuleError(422, "NO_POPULATION");

    const result = samplePlan({
      workers,
      projects: input.projects,
      locations: input.locations,
      strata,
      z: draft.sampling.z,
      marginOfError: draft.sampling.marginOfError,
      proportion: draft.sampling.proportion,
      minParticipation: draft.sampling.minParticipationPerStratum,
      interviewFactorManagement: draft.sampling.sclInterviewFactorManagement,
      interviewFactorOperational: draft.sampling.sclInterviewFactorOperational,
      projectFactor: draft.sampling.sclProjectFactor,
    });
    const stored = { projects: input.projects, locations: input.locations, computedAt: new Date().toISOString(), result };
    await tx.assessment.update({ where: { id: actor.assessmentId }, data: { parameterDraft: asJson({ ...draft, samplePlan: stored }) } });
    await logAudit(tx, {
      action: "assessment.sample_plan_saved",
      entityType: "Assessment",
      entityId: actor.assessmentId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      after: {
        workers,
        projects: input.projects,
        locations: input.locations,
        recommendedSurvey: result.recommendedSurvey,
        surveyTargetTotal: result.surveyTargetTotal,
      },
      meta,
    });
  });
}

// ---------------------------------------------------------------------------
// Tim asesor
// ---------------------------------------------------------------------------

export async function addAssignment(
  actor: AssessmentActor,
  input: { userId: string; role: "LEAD_ASSESSOR" | "ASSESSOR" },
  meta: RequestMeta,
): Promise<void> {
  const db = getDb();
  // Hanya staf Nusa Safety yang aktif dengan peran asesor di organisasi operator.
  const staff = await db.user.findFirst({
    where: {
      id: input.userId,
      isActive: true,
      memberships: { some: { role: { in: ["LEAD_ASSESSOR", "ASSESSOR"] }, organization: { isOperator: true } } },
    },
    select: { id: true, email: true },
  });
  if (!staff) throw new AssessmentRuleError(422, "NOT_ASSESSOR_STAFF");
  try {
    await db.$transaction(async (tx) => {
      const status = await lockAssessment(tx, actor.assessmentId);
      if (!areUnitsEditable(status)) throw new AssessmentRuleError(409, "ASSESSMENT_ARCHIVED");
      const assignment = await tx.assessmentAssignment.create({
        data: { assessmentId: actor.assessmentId, userId: staff.id, role: input.role },
        select: { id: true },
      });
      await logAudit(tx, {
        action: "assignment.create",
        entityType: "AssessmentAssignment",
        entityId: assignment.id,
        actor: actorOf(actor),
        organizationId: actor.organizationId,
        assessmentId: actor.assessmentId,
        after: { userId: staff.id, email: staff.email, role: input.role },
        meta,
      });
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new AssessmentRuleError(422, "ALREADY_ASSIGNED");
    throw error;
  }
}

export async function removeAssignment(actor: AssessmentActor, assignmentId: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const status = await lockAssessment(tx, actor.assessmentId);
    if (!areUnitsEditable(status)) throw new AssessmentRuleError(409, "ASSESSMENT_ARCHIVED");
    const assignment = await tx.assessmentAssignment.findFirst({ where: { id: assignmentId, assessmentId: actor.assessmentId } });
    if (!assignment) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (assignment.role === "LEAD_ASSESSOR") {
      const leads = await tx.assessmentAssignment.count({ where: { assessmentId: actor.assessmentId, role: "LEAD_ASSESSOR" } });
      if (leads <= 1) throw new AssessmentRuleError(422, "LAST_LEAD_ASSESSOR");
    }
    await tx.assessmentAssignment.delete({ where: { id: assignmentId } });
    await logAudit(tx, {
      action: "assignment.delete",
      entityType: "AssessmentAssignment",
      entityId: assignmentId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { userId: assignment.userId, role: assignment.role },
      meta,
    });
  });
}

// ---------------------------------------------------------------------------
// Transisi status
// ---------------------------------------------------------------------------

export async function gatherTransitionFacts(tx: Tx, assessmentId: string, now: Date = new Date()): Promise<TransitionFacts> {
  const assessment = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      instrumentVersionId: true,
      instrumentVersion: { select: { status: true } },
      consentTextId: true,
      dpaSigned: true,
      parameterDraft: true,
      parameterSnapshot: true,
      surveyClosesAt: true,
      actionPlanPublishedAt: true,
    },
  });
  const [unitCount, strata, leadAssessorCount, rosterCount, surveyTokenCount, characteristicCount, ratingGroups, scoreRunCount, finalScoreRun, unjustifiedAdjustmentCount, finalReport, destructionCount] =
    await Promise.all([
      tx.unit.count({ where: { assessmentId } }),
      tx.stratum.findMany({ where: { assessmentId }, select: { population: true } }),
      tx.assessmentAssignment.count({ where: { assessmentId, role: "LEAD_ASSESSOR" } }),
      tx.rosterEntry.count({ where: { assessmentId } }),
      tx.accessToken.count({ where: { assessmentId, kind: "SURVEY", revokedAt: null } }),
      tx.characteristic.count({ where: { instrumentVersionId: assessment.instrumentVersionId } }),
      tx.evidenceRating.groupBy({ by: ["characteristicId"], where: { assessmentId }, _count: { assessorId: true } }),
      tx.scoreRun.count({ where: { assessmentId } }),
      tx.scoreRun.count({ where: { assessmentId, isFinal: true } }),
      tx.panelAdjustment.count({ where: { scoreRun: { assessmentId }, rationale: "" } }),
      tx.report.findFirst({ where: { assessmentId, kind: "FULL", status: "FINAL", signedAt: { not: null } }, select: { signedAt: true } }),
      tx.destructionRecord.count({ where: { assessmentId } }),
    ]);

  const draft = assessment.parameterDraft as unknown as DraftParameters | null;
  const snapshot = assessment.parameterSnapshot as unknown as { samplePlan?: unknown; parameters?: DraftParameters } | null;
  const retentionMonths = snapshot?.parameters?.retention?.rawDataMonths ?? draft?.retention?.rawDataMonths ?? 36;
  const retentionEnd = finalReport?.signedAt ? new Date(finalReport.signedAt) : null;
  retentionEnd?.setUTCMonth(retentionEnd.getUTCMonth() + retentionMonths);

  return {
    unitCount,
    strataCount: strata.length,
    strataWithoutPopulation: strata.filter((s) => s.population <= 0).length,
    instrumentPublished: assessment.instrumentVersion.status === "PUBLISHED",
    leadAssessorCount,
    consentTextFilled: Boolean(assessment.consentTextId?.trim()),
    dpaSigned: assessment.dpaSigned,
    samplePlanSaved: Boolean(snapshot?.samplePlan ?? draft?.samplePlan),
    rosterCount,
    surveyTokenCount,
    surveyClosed: assessment.surveyClosesAt !== null && assessment.surveyClosesAt.getTime() <= now.getTime(),
    characteristicCount,
    characteristicsWithTwoAssessors: ratingGroups.filter((g) => g._count.assessorId >= 2).length,
    scoreRunCount,
    finalScoreRun: finalScoreRun > 0,
    unjustifiedAdjustmentCount,
    finalReportSigned: Boolean(finalReport),
    actionPlanPublished: assessment.actionPlanPublishedAt !== null,
    retentionExpired: retentionEnd !== null && retentionEnd.getTime() <= now.getTime(),
    destructionRecorded: destructionCount > 0,
  };
}

/** Isi snapshot saat dikunci: parameter, hasil kalkulator, strata, unit, teks persetujuan, dan versi instrumen. */
async function buildParameterSnapshot(tx: Tx, assessmentId: string, now: Date) {
  const a = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      scopeType: true,
      periodStart: true,
      periodEnd: true,
      targetLevel: true,
      consentTextId: true,
      consentTextEn: true,
      dpaSigned: true,
      instrumentVersion: { select: { id: true, code: true } },
    },
  });
  const [strata, units] = await Promise.all([
    tx.stratum.findMany({ where: { assessmentId }, select: { id: true, code: true, name: true, group: true, population: true, isContractor: true }, orderBy: { code: "asc" } }),
    tx.unit.findMany({ where: { assessmentId }, select: { id: true, parentId: true, name: true, type: true }, orderBy: { name: "asc" } }),
  ]);
  const { samplePlan: plan, ...parameters } = await loadDraft(tx, assessmentId);
  return {
    schemaVersion: 1,
    lockedAt: now.toISOString(),
    instrumentVersion: a.instrumentVersion,
    scopeType: a.scopeType,
    period: { start: a.periodStart.toISOString().slice(0, 10), end: a.periodEnd.toISOString().slice(0, 10) },
    targetLevel: a.targetLevel,
    parameters,
    samplePlan: plan ?? null,
    strata,
    units,
    consent: { id: a.consentTextId, en: a.consentTextEn },
    dpaSigned: a.dpaSigned,
  };
}

export async function transitionAssessment(actor: AssessmentActor, to: AssessmentStatus, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const from = await lockAssessment(tx, actor.assessmentId);
    const definition = findTransition(from, to);
    if (!definition) throw new AssessmentRuleError(409, "INVALID_TRANSITION", { from, to });
    if (!definition.actorRoles.some((r) => actor.roles.includes(r))) throw new AssessmentRuleError(403, "FORBIDDEN");

    const now = new Date();
    const evaluation = evaluateTransition(definition, await gatherTransitionFacts(tx, actor.assessmentId, now));
    if (!evaluation.allowed) {
      throw new AssessmentRuleError(422, "TRANSITION_BLOCKED", { unmet: evaluation.conditions.filter((c) => !c.met).map((c) => c.code) });
    }

    const data: Prisma.AssessmentUpdateInput = { status: to };
    let snapshotSummary: Record<string, unknown> | undefined;
    if (to === "LOCKED") {
      const snapshot = await buildParameterSnapshot(tx, actor.assessmentId, now);
      data.parameterSnapshot = asJson(snapshot);
      data.lockedAt = now;
      data.lockedBy = { connect: { id: actor.session.user.id } };
      snapshotSummary = {
        instrumentVersion: snapshot.instrumentVersion.code,
        strata: snapshot.strata.map((s) => ({ code: s.code, population: s.population })),
        layerWeights: snapshot.parameters.layerWeights,
        surveyTargetTotal: (snapshot.samplePlan as { result?: { surveyTargetTotal?: number } } | null)?.result?.surveyTargetTotal ?? null,
      };
    }
    await tx.assessment.update({ where: { id: actor.assessmentId }, data });
    await logAudit(tx, {
      action: "assessment.status_change",
      entityType: "Assessment",
      entityId: actor.assessmentId,
      actor: actorOf(actor),
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { status: from },
      after: { status: to, conditions: evaluation.conditions, ...(snapshotSummary ? { snapshot: snapshotSummary } : {}) },
      meta,
    });
  });
}
