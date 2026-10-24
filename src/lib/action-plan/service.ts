import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ActionStatus, AssessmentStatus, Role } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import type { EngineParameters, EngineResult } from "@/lib/scoring";
import { buildGapList, dueState, quarterOf, type actionSchema, type gapAnalysisSchema, type progressSchema, type verificationSchema } from "./rules";

// Daftar kesenjangan dan rencana aksi (docs/01 M10). Daftar dibentuk dari ScoreRun final; tim mengisi analisis
// penyebab dan prioritas; tindakan memiliki penanggung jawab, tenggat, indikator keberhasilan, dan status;
// kemajuan diperbarui berkala dan diverifikasi asesor. Seluruh perubahan tercatat di jejak audit.

type Tx = Prisma.TransactionClient;

export interface PlanActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
  /** Null bila tidak dibatasi unit; berisi id unit untuk koordinator unit. */
  unitScope: string[] | null;
}

export const PLAN_STATUSES: readonly AssessmentStatus[] = ["ACTION_PLANNING", "REPORTED", "MONITORING"];
const PUBLISH_STATUSES: readonly AssessmentStatus[] = ["ACTION_PLANNING", "REPORTED"];

const actorOf = (a: PlanActor) => ({ id: a.session.user.id, role: a.roles[0] ?? null });

function audit(actor: PlanActor, entry: { action: Parameters<typeof logAudit>[1]["action"]; entityType: string; entityId: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }, meta: RequestMeta) {
  return { ...entry, actor: actorOf(actor), organizationId: actor.organizationId, assessmentId: actor.assessmentId, meta };
}

async function lockStatus(tx: Tx, assessmentId: string, allowed: readonly AssessmentStatus[], code = "PLAN_CLOSED"): Promise<void> {
  const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`SELECT "status" FROM "Assessment" WHERE "id" = ${assessmentId} FOR UPDATE`;
  if (!rows[0]) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (!allowed.includes(rows[0].status)) throw new AssessmentRuleError(409, code, { status: rows[0].status });
}

/** Koordinator unit hanya mengelola tindakan unitnya. */
function assertUnit(actor: PlanActor, unitId: string | null) {
  if (actor.unitScope && (!unitId || !actor.unitScope.includes(unitId))) throw new AssessmentRuleError(403, "FORBIDDEN");
}

// ---------------------------------------------------------------------------
// Daftar kesenjangan
// ---------------------------------------------------------------------------

export async function generateGapList(actor: PlanActor, meta: RequestMeta): Promise<number> {
  return getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, PLAN_STATUSES);
    const run = await tx.scoreRun.findFirst({ where: { assessmentId: actor.assessmentId, isFinal: true }, select: { id: true, finalResult: true, parameterSnapshot: true } });
    if (!run?.finalResult) throw new AssessmentRuleError(409, "RESULT_NOT_FINAL");
    const a = await tx.assessment.findUniqueOrThrow({ where: { id: actor.assessmentId }, select: { targetLevel: true, instrumentVersionId: true } });
    const params = (run.parameterSnapshot as unknown as { engine: EngineParameters }).engine;
    const list = buildGapList(run.finalResult as unknown as EngineResult, params, a.targetLevel);
    const characteristics = await tx.characteristic.findMany({ where: { instrumentVersionId: a.instrumentVersionId }, select: { id: true, code: true } });
    const idOf = new Map(characteristics.map((c) => [c.code, c.id]));
    for (const g of list) {
      const characteristicId = idOf.get(g.code);
      if (!characteristicId) continue;
      const data = { currentIndex: g.currentIndex, targetLevel: a.targetLevel, gap: g.gap, priorityScore: g.priorityScore, rank: g.rank, isContextual: g.isContextual, scoreRunId: run.id };
      // Analisis penyebab, prioritas, dan tindakan yang sudah diisi dipertahankan.
      await tx.gapItem.upsert({
        where: { assessmentId_characteristicId: { assessmentId: actor.assessmentId, characteristicId } },
        create: { assessmentId: actor.assessmentId, characteristicId, ...data },
        update: data,
      });
    }
    await logAudit(tx, audit(actor, { action: "gap.generate", entityType: "Assessment", entityId: actor.assessmentId, after: { scoreRunId: run.id, items: list.map((g) => ({ code: g.code, gap: g.gap, rank: g.rank })) } }, meta));
    return list.length;
  });
}

export async function updateGapAnalysis(actor: PlanActor, gapId: string, input: z.output<typeof gapAnalysisSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, PLAN_STATUSES);
    const gap = await tx.gapItem.findFirst({ where: { id: gapId, assessmentId: actor.assessmentId }, select: { id: true, rootCause: true, priority: true, characteristic: { select: { code: true } } } });
    if (!gap) throw new AssessmentRuleError(404, "NOT_FOUND");
    await tx.gapItem.update({ where: { id: gapId }, data: { rootCause: input.rootCause, priority: input.priority } });
    await logAudit(
      tx,
      audit(actor, { action: "gap.update", entityType: "GapItem", entityId: gapId, before: { characteristic: gap.characteristic.code, rootCause: gap.rootCause, priority: gap.priority }, after: { characteristic: gap.characteristic.code, ...input } }, meta),
    );
  });
}

// ---------------------------------------------------------------------------
// Tindakan
// ---------------------------------------------------------------------------

async function assertUnitInAssessment(tx: Tx, assessmentId: string, unitId: string | null) {
  if (unitId && !(await tx.unit.count({ where: { id: unitId, assessmentId } }))) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");
}

const dueDateOf = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export async function createAction(actor: PlanActor, gapId: string, input: z.output<typeof actionSchema>, meta: RequestMeta): Promise<string> {
  assertUnit(actor, input.unitId);
  return getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, PLAN_STATUSES);
    const gap = await tx.gapItem.findFirst({ where: { id: gapId, assessmentId: actor.assessmentId }, select: { id: true, characteristic: { select: { code: true } } } });
    if (!gap) throw new AssessmentRuleError(404, "NOT_FOUND");
    await assertUnitInAssessment(tx, actor.assessmentId, input.unitId);
    const action = await tx.actionItem.create({
      data: { gapItemId: gapId, ...input, dueDate: dueDateOf(input.dueDate), createdById: actor.session.user.id },
      select: { id: true },
    });
    await logAudit(tx, audit(actor, { action: "action.create", entityType: "ActionItem", entityId: action.id, after: { characteristic: gap.characteristic.code, ...input } }, meta));
    return action.id;
  });
}

async function loadAction(tx: Tx, actor: PlanActor, actionId: string) {
  const action = await tx.actionItem.findFirst({
    where: { id: actionId, gapItem: { assessmentId: actor.assessmentId } },
    select: { id: true, title: true, description: true, ownerName: true, ownerPosition: true, ownerEmail: true, unitId: true, dueDate: true, successIndicator: true, status: true },
  });
  if (!action) throw new AssessmentRuleError(404, "NOT_FOUND");
  assertUnit(actor, action.unitId);
  return action;
}

export async function updateAction(actor: PlanActor, actionId: string, input: z.output<typeof actionSchema>, meta: RequestMeta): Promise<void> {
  assertUnit(actor, input.unitId);
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, PLAN_STATUSES);
    const before = await loadAction(tx, actor, actionId);
    if (before.status === "VERIFIED") throw new AssessmentRuleError(409, "ACTION_VERIFIED");
    await assertUnitInAssessment(tx, actor.assessmentId, input.unitId);
    await tx.actionItem.update({ where: { id: actionId }, data: { ...input, dueDate: dueDateOf(input.dueDate) } });
    await logAudit(
      tx,
      audit(actor, { action: "action.update", entityType: "ActionItem", entityId: actionId, before: { ...before, dueDate: before.dueDate.toISOString().slice(0, 10) }, after: { ...input } }, meta),
    );
  });
}

export async function addProgress(actor: PlanActor, actionId: string, input: z.output<typeof progressSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, PLAN_STATUSES);
    const action = await loadAction(tx, actor, actionId);
    if (action.status === "VERIFIED") throw new AssessmentRuleError(409, "ACTION_VERIFIED");
    const progressPercent = input.status === "DONE" ? 100 : input.progressPercent;
    const update = await tx.actionUpdate.create({ data: { actionItemId: actionId, note: input.note, progressPercent, status: input.status, createdById: actor.session.user.id }, select: { id: true } });
    if (action.status !== input.status) await tx.actionItem.update({ where: { id: actionId }, data: { status: input.status } });
    await logAudit(
      tx,
      audit(actor, { action: "action.progress", entityType: "ActionItem", entityId: actionId, before: { status: action.status }, after: { updateId: update.id, status: input.status, progressPercent, note: input.note } }, meta),
    );
  });
}

/** Verifikasi asesor atas tindakan berstatus selesai: disetujui menjadi VERIFIED, ditolak kembali ke IN_PROGRESS. */
export async function verifyAction(actor: PlanActor, actionId: string, input: z.output<typeof verificationSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, PLAN_STATUSES);
    const action = await loadAction(tx, actor, actionId);
    if (action.status !== "DONE") throw new AssessmentRuleError(409, "ACTION_NOT_DONE");
    const status: ActionStatus = input.approve ? "VERIFIED" : "IN_PROGRESS";
    const now = new Date();
    await tx.actionItem.update({
      where: { id: actionId },
      data: input.approve ? { status, verifiedById: actor.session.user.id, verifiedAt: now } : { status, verifiedById: null, verifiedAt: null },
    });
    const last = await tx.actionUpdate.findFirst({ where: { actionItemId: actionId }, orderBy: { createdAt: "desc" }, select: { progressPercent: true } });
    await tx.actionUpdate.create({ data: { actionItemId: actionId, note: input.note, progressPercent: input.approve ? 100 : (last?.progressPercent ?? 0), status, createdById: actor.session.user.id } });
    await logAudit(tx, audit(actor, { action: "action.verify", entityType: "ActionItem", entityId: actionId, before: { status: action.status }, after: { status, approve: input.approve, note: input.note } }, meta));
  });
}

/**
 * Menerbitkan rencana aksi ke klien (syarat REPORTED ke MONITORING). Setiap butir kesenjangan wajib memiliki
 * analisis penyebab dan paling sedikit satu tindakan yang tidak dibatalkan.
 */
export async function publishActionPlan(actor: PlanActor, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, PUBLISH_STATUSES);
    const gaps = await tx.gapItem.findMany({
      where: { assessmentId: actor.assessmentId },
      select: { rootCause: true, characteristic: { select: { code: true } }, actions: { where: { status: { not: "CANCELLED" } }, select: { id: true } } },
    });
    if (gaps.length === 0) throw new AssessmentRuleError(409, "GAP_LIST_MISSING");
    const incomplete = gaps.filter((g) => !g.rootCause?.trim() || g.actions.length === 0).map((g) => g.characteristic.code);
    if (incomplete.length) throw new AssessmentRuleError(409, "ACTION_PLAN_INCOMPLETE", { unmet: incomplete });
    const a = await tx.assessment.update({ where: { id: actor.assessmentId }, data: { actionPlanPublishedAt: new Date() }, select: { actionPlanPublishedAt: true } });
    await logAudit(tx, audit(actor, { action: "action_plan.publish", entityType: "Assessment", entityId: actor.assessmentId, after: { publishedAt: a.actionPlanPublishedAt?.toISOString(), gapItems: gaps.length } }, meta));
  });
}

// ---------------------------------------------------------------------------
// Pembacaan
// ---------------------------------------------------------------------------

export async function loadActionPlan(assessmentId: string, unitScope: readonly string[] | null, now: Date = new Date()) {
  const db = getDb();
  const [assessment, finalRun, gaps, units] = await Promise.all([
    db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { status: true, targetLevel: true, actionPlanPublishedAt: true } }),
    db.scoreRun.findFirst({ where: { assessmentId, isFinal: true }, select: { id: true } }),
    db.gapItem.findMany({
      where: { assessmentId },
      orderBy: [{ rank: "asc" }],
      select: {
        id: true,
        rank: true,
        currentIndex: true,
        targetLevel: true,
        gap: true,
        priorityScore: true,
        isContextual: true,
        rootCause: true,
        priority: true,
        characteristic: { select: { code: true, nameId: true, aspect: { select: { code: true, name: true } } } },
        actions: {
          where: unitScope ? { unitId: { in: [...unitScope] } } : {},
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            description: true,
            ownerName: true,
            ownerPosition: true,
            ownerEmail: true,
            unitId: true,
            dueDate: true,
            successIndicator: true,
            status: true,
            verifiedAt: true,
            unit: { select: { name: true } },
            verifiedBy: { select: { name: true } },
            updates: { orderBy: { createdAt: "desc" }, select: { id: true, note: true, progressPercent: true, status: true, createdAt: true, createdBy: { select: { name: true } } } },
          },
        },
      },
    }),
    db.unit.findMany({ where: { assessmentId, ...(unitScope ? { id: { in: [...unitScope] } } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    status: assessment.status,
    targetLevel: assessment.targetLevel,
    publishedAt: assessment.actionPlanPublishedAt,
    hasFinalResult: Boolean(finalRun),
    units,
    gaps: gaps.map((g) => ({
      ...g,
      actions: g.actions.map((a) => ({ ...a, progress: a.updates[0]?.progressPercent ?? 0, dueState: dueState(a, now), quarter: quarterOf(a.dueDate) })),
    })),
  };
}

export type ActionPlanModel = Awaited<ReturnType<typeof loadActionPlan>>;

/** Pemantauan triwulanan: tindakan dikelompokkan menurut triwulan tenggat. */
export function groupByQuarter(model: ActionPlanModel) {
  const actions = model.gaps.flatMap((g) => g.actions.map((a) => ({ ...a, gapCode: g.characteristic.code, gapName: g.characteristic.nameId })));
  const quarters = new Map<string, { key: string; year: number; quarter: number; actions: typeof actions }>();
  for (const a of actions) {
    const q = quarters.get(a.quarter.key) ?? { key: a.quarter.key, year: a.quarter.year, quarter: a.quarter.quarter, actions: [] };
    q.actions.push(a);
    quarters.set(a.quarter.key, q);
  }
  return [...quarters.values()]
    .sort((x, y) => x.key.localeCompare(y.key))
    .map((q) => ({
      ...q,
      counts: {
        total: q.actions.length,
        planned: q.actions.filter((a) => a.status === "PLANNED").length,
        inProgress: q.actions.filter((a) => a.status === "IN_PROGRESS").length,
        done: q.actions.filter((a) => a.status === "DONE").length,
        verified: q.actions.filter((a) => a.status === "VERIFIED").length,
        cancelled: q.actions.filter((a) => a.status === "CANCELLED").length,
        overdue: q.actions.filter((a) => a.dueState === "overdue").length,
      },
      averageProgress: q.actions.length ? q.actions.reduce((s, a) => s + a.progress, 0) / q.actions.length : 0,
    }));
}
