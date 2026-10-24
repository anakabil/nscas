import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role, StratumGroup } from "@/generated/prisma/enums";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { runEngine, toEngineParameters, type EngineParameters, type EngineResult, type ParameterSnapshot } from "@/lib/scoring";
import { buildScoringInput, sclAspectCodes, withPanelAdjustments, type ScoringInputSnapshot, type ScoringRows } from "./engine-input";
import { SCL_STEPS, visibleOtherRatings, type evidenceRatingSchema, type panelAdjustmentSchema, type sclAspectSchema } from "./rules";

// Penilaian asesor dan rapat panel (docs/01 M8). Nilai bukti diisi tiap asesor; jalur setara Safety Culture
// Ladder diisi asesor utama; mesin dijalankan dari data basis data dan parameter snapshot, lalu disimpan sebagai
// ScoreRun. Rapat panel menyesuaikan nilai akhir karakteristik dengan alasan wajib dan menetapkan hasil. Setelah
// final, ScoreRun dan penyesuaiannya tidak dapat diubah (pemicu basis data menolak perubahan).

type Tx = Prisma.TransactionClient;

export interface ScoringActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
}

/** Nilai bukti dan jalur setara masuk ke mesin; setelah rapat panel dimulai, keduanya tidak dapat diubah. */
export const RATING_STATUSES: readonly AssessmentStatus[] = ["DATA_COLLECTION", "SCORING"];
export const RUN_STATUSES: readonly AssessmentStatus[] = ["SCORING"];
export const PANEL_STATUSES: readonly AssessmentStatus[] = ["PANEL_REVIEW"];

const actorOf = (a: ScoringActor) => ({ id: a.session.user.id, role: a.roles[0] ?? null });

function audit(actor: ScoringActor, entry: { action: Parameters<typeof logAudit>[1]["action"]; entityType: string; entityId: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }, meta: RequestMeta) {
  return { ...entry, actor: actorOf(actor), organizationId: actor.organizationId, assessmentId: actor.assessmentId, meta };
}

async function lockStatus(tx: Tx, assessmentId: string, allowed: readonly AssessmentStatus[], code: string): Promise<void> {
  const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`SELECT "status" FROM "Assessment" WHERE "id" = ${assessmentId} FOR UPDATE`;
  if (!rows[0]) throw new AssessmentRuleError(404, "NOT_FOUND");
  if (!allowed.includes(rows[0].status)) throw new AssessmentRuleError(409, code, { status: rows[0].status });
}

interface LockedSnapshot {
  parameters: Omit<ParameterSnapshot, "aspects"> & { aspects: (ParameterSnapshot["aspects"][number] & { name: string })[] };
  strata?: { id: string; code: string; group: StratumGroup; population: number }[];
}

/** Parameter dan strata dari Assessment.parameterSnapshot (CLAUDE.md aturan 5), bukan dari berkas seed. */
async function lockedParameters(db: Pick<Tx, "assessment">, assessmentId: string) {
  const a = await db.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: { parameterSnapshot: true, targetLevel: true, instrumentVersionId: true, status: true },
  });
  const snapshot = a.parameterSnapshot as unknown as LockedSnapshot | null;
  if (!snapshot?.parameters) throw new AssessmentRuleError(409, "SNAPSHOT_MISSING");
  return { snapshot, params: toEngineParameters(snapshot.parameters), targetLevel: a.targetLevel, instrumentVersionId: a.instrumentVersionId, status: a.status };
}

async function instrumentCharacteristics(db: Pick<Tx, "characteristic">, instrumentVersionId: string) {
  return db.characteristic.findMany({
    where: { instrumentVersionId },
    orderBy: { order: "asc" },
    select: { id: true, code: true, nameId: true, isContextual: true, aspect: { select: { code: true, name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Nilai bukti per karakteristik
// ---------------------------------------------------------------------------

/** Ringkasan per karakteristik untuk asesor: nilainya sendiri dan jumlah asesor yang sudah menilai. */
export async function loadRatingOverview(assessmentId: string, viewerId: string) {
  const db = getDb();
  const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { instrumentVersionId: true, status: true } });
  const characteristics = await instrumentCharacteristics(db, a.instrumentVersionId);
  const [ratings, links] = await Promise.all([
    db.evidenceRating.findMany({ where: { assessmentId }, select: { characteristicId: true, assessorId: true, level: true } }),
    db.evidenceLink.groupBy({ by: ["characteristicId"], where: { evidenceItem: { assessmentId, deletedAt: null, supersededBy: null } }, _count: { _all: true } }),
  ]);
  return {
    status: a.status,
    characteristics: characteristics.map((c) => {
      const mine = ratings.find((r) => r.characteristicId === c.id && r.assessorId === viewerId);
      return {
        id: c.id,
        code: c.code,
        name: c.nameId,
        aspectCode: c.aspect.code,
        aspectName: c.aspect.name,
        isContextual: c.isContextual,
        ownLevel: mine?.level ?? null,
        raters: ratings.filter((r) => r.characteristicId === c.id).length,
        evidence: links.find((l) => l.characteristicId === c.id)?._count._all ?? 0,
      };
    }),
  };
}

/**
 * Layar penilaian satu karakteristik: lima pernyataan berjenjang, bukti yang dipetakan, rekaman observasi
 * asesmen, nilai asesor sendiri, dan nilai asesor lain hanya bila asesor sudah menyimpan nilainya.
 */
export async function loadRatingWorkspace(assessmentId: string, characteristicCode: string, viewerId: string) {
  const db = getDb();
  const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { instrumentVersionId: true, status: true } });
  const characteristic = await db.characteristic.findFirst({
    where: { instrumentVersionId: a.instrumentVersionId, code: characteristicCode },
    select: {
      id: true,
      code: true,
      nameId: true,
      isContextual: true,
      aspect: { select: { code: true, name: true } },
      levelStatements: { orderBy: { level: "asc" }, select: { level: true, textId: true } },
      evidenceRequirements: { orderBy: { order: "asc" }, select: { id: true, description: true } },
    },
  });
  if (!characteristic) return null;
  const [evidence, captures, ratings] = await Promise.all([
    db.evidenceItem.findMany({
      where: { assessmentId, deletedAt: null, supersededBy: null, links: { some: { characteristicId: characteristic.id } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        mimeType: true,
        version: true,
        createdAt: true,
        unit: { select: { name: true } },
        links: { where: { characteristicId: characteristic.id }, select: { requirementIds: true } },
      },
    }),
    db.observationCapture.findMany({
      where: { window: { assessmentId } },
      orderBy: { serverCapturedAt: "desc" },
      select: { id: true, checklistItemCode: true, mimeType: true, serverCapturedAt: true, outsideRadius: true, note: true, window: { select: { title: true, checklist: true, unit: { select: { name: true } } } } },
    }),
    db.evidenceRating.findMany({
      where: { assessmentId, characteristicId: characteristic.id },
      orderBy: { updatedAt: "asc" },
      select: { assessorId: true, level: true, rationale: true, evidenceIds: true, observationIds: true, updatedAt: true, assessor: { select: { name: true } } },
    }),
  ]);
  const visible = visibleOtherRatings(ratings, viewerId);
  const requirementLabel = new Map(characteristic.evidenceRequirements.map((r) => [r.id, r.description]));
  return {
    status: a.status,
    characteristic: { id: characteristic.id, code: characteristic.code, name: characteristic.nameId, aspectCode: characteristic.aspect.code, aspectName: characteristic.aspect.name, isContextual: characteristic.isContextual },
    statements: characteristic.levelStatements,
    evidence: evidence.map((e) => ({
      id: e.id,
      title: e.title,
      mimeType: e.mimeType,
      version: e.version,
      createdAt: e.createdAt,
      unitName: e.unit?.name ?? null,
      requirements: (e.links[0]?.requirementIds ?? []).map((r) => requirementLabel.get(r)).filter((l): l is string => Boolean(l)),
    })),
    observations: captures.map((c) => {
      const items = Array.isArray(c.window.checklist) ? (c.window.checklist as { code: string; label: string }[]) : [];
      return {
        id: c.id,
        mimeType: c.mimeType,
        capturedAt: c.serverCapturedAt,
        outsideRadius: c.outsideRadius,
        note: c.note,
        windowTitle: c.window.title,
        unitName: c.window.unit.name,
        itemLabel: items.find((i) => i.code === c.checklistItemCode)?.label ?? c.checklistItemCode,
      };
    }),
    own: visible.own ? { level: visible.own.level, rationale: visible.own.rationale, evidenceIds: visible.own.evidenceIds, observationIds: visible.own.observationIds, updatedAt: visible.own.updatedAt } : null,
    others: visible.others.map((r) => ({ assessorName: r.assessor.name, level: r.level, rationale: r.rationale, updatedAt: r.updatedAt })),
    hiddenCount: visible.hiddenCount,
  };
}

export async function saveEvidenceRating(actor: ScoringActor, characteristicCode: string, input: z.output<typeof evidenceRatingSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, RATING_STATUSES, "EVIDENCE_RATING_CLOSED");
    const a = await tx.assessment.findUniqueOrThrow({ where: { id: actor.assessmentId }, select: { instrumentVersionId: true } });
    const characteristic = await tx.characteristic.findFirst({ where: { instrumentVersionId: a.instrumentVersionId, code: characteristicCode }, select: { id: true } });
    if (!characteristic) throw new AssessmentRuleError(404, "NOT_FOUND");
    const evidenceIds = [...new Set(input.evidenceIds)];
    const observationIds = [...new Set(input.observationIds)];
    const [evidenceCount, observationCount] = [
      await tx.evidenceItem.count({ where: { id: { in: evidenceIds }, assessmentId: actor.assessmentId, deletedAt: null } }),
      await tx.observationCapture.count({ where: { id: { in: observationIds }, window: { assessmentId: actor.assessmentId } } }),
    ];
    if (evidenceCount !== evidenceIds.length || observationCount !== observationIds.length) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");

    const assessorId = actor.session.user.id;
    const where = { assessmentId_characteristicId_assessorId: { assessmentId: actor.assessmentId, characteristicId: characteristic.id, assessorId } };
    const before = await tx.evidenceRating.findUnique({ where, select: { id: true, level: true, rationale: true, evidenceIds: true, observationIds: true } });
    const data = { level: input.level, rationale: input.rationale, evidenceIds, observationIds };
    const saved = await tx.evidenceRating.upsert({ where, create: { assessmentId: actor.assessmentId, characteristicId: characteristic.id, assessorId, ...data }, update: data, select: { id: true } });
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "rating.evidence_save",
          entityType: "EvidenceRating",
          entityId: saved.id,
          before: before ? { characteristic: characteristicCode, level: before.level, rationale: before.rationale, evidenceIds: before.evidenceIds, observationIds: before.observationIds } : null,
          after: { characteristic: characteristicCode, ...data },
        },
        meta,
      ),
    );
  });
}

// ---------------------------------------------------------------------------
// Jalur setara Safety Culture Ladder
// ---------------------------------------------------------------------------

export async function loadScl(assessmentId: string) {
  const db = getDb();
  const { snapshot, params } = await lockedParameters(db, assessmentId);
  const codes = sclAspectCodes(params);
  const rows = await db.sclFulfillment.findMany({
    where: { assessmentId },
    select: { aspectCode: true, step: true, percent: true, justification: true, updatedAt: true, enteredBy: { select: { name: true } } },
  });
  const weights = new Map(params.aspects.map((a) => [a.code, a.maxPointsStep5]));
  const total = [...weights.values()].reduce<number>((s, v) => s + (v ?? 0), 0);
  return {
    aspects: codes.map((code) => ({
      code,
      name: snapshot.parameters.aspects.find((a) => a.code === code)?.name ?? code,
      weight: (weights.get(code) ?? 0) / total,
      entries: SCL_STEPS.map((step) => rows.find((r) => r.aspectCode === code && r.step === step) ?? null),
    })),
    complete: rows.length >= codes.length * SCL_STEPS.length && codes.every((c) => SCL_STEPS.every((s) => rows.some((r) => r.aspectCode === c && r.step === s))),
  };
}

export async function saveSclAspect(actor: ScoringActor, input: z.output<typeof sclAspectSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, RATING_STATUSES, "SCL_CLOSED");
    const { params } = await lockedParameters(tx, actor.assessmentId);
    if (!sclAspectCodes(params).includes(input.aspectCode)) throw new AssessmentRuleError(422, "UNKNOWN_ITEM");
    const before = await tx.sclFulfillment.findMany({ where: { assessmentId: actor.assessmentId, aspectCode: input.aspectCode }, select: { step: true, percent: true, justification: true }, orderBy: { step: "asc" } });
    for (const e of input.entries) {
      const data = { percent: e.percent, justification: e.justification, enteredById: actor.session.user.id };
      await tx.sclFulfillment.upsert({
        where: { assessmentId_aspectCode_step: { assessmentId: actor.assessmentId, aspectCode: input.aspectCode, step: e.step } },
        create: { assessmentId: actor.assessmentId, aspectCode: input.aspectCode, step: e.step, ...data },
        update: data,
      });
    }
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "rating.scl_save",
          entityType: "SclFulfillment",
          entityId: `${actor.assessmentId}:${input.aspectCode}`,
          before: before.length ? { aspectCode: input.aspectCode, entries: before } : null,
          after: { aspectCode: input.aspectCode, entries: [...input.entries].sort((x, y) => x.step - y.step) },
        },
        meta,
      ),
    );
  });
}

// ---------------------------------------------------------------------------
// Eksekusi mesin
// ---------------------------------------------------------------------------

/** Mengumpulkan data asesmen dari basis data menjadi masukan mesin. Kueri berurutan (aman di dalam transaksi). */
export async function gatherScoringRows(tx: Tx, assessmentId: string): Promise<{ rows: ScoringRows; params: EngineParameters; parameterSnapshot: ParameterSnapshot }> {
  const { snapshot, params, targetLevel, instrumentVersionId } = await lockedParameters(tx, assessmentId);
  if (!snapshot.strata) throw new AssessmentRuleError(409, "SNAPSHOT_MISSING");
  const characteristics = await instrumentCharacteristics(tx, instrumentVersionId);
  const responses = await tx.surveyResponse.findMany({
    where: { assessmentId, excluded: false },
    select: { stratumId: true, characteristicAnswers: { select: { characteristicId: true, level: true } } },
  });
  const selfAssessments = await tx.selfAssessment.findMany({
    where: { assessmentId, status: "SUBMITTED" },
    select: { answers: { select: { characteristicId: true, level: true } } },
  });
  const evidenceRatings = await tx.evidenceRating.findMany({ where: { assessmentId }, select: { characteristicId: true, assessorId: true, level: true } });
  const validationRatings = await tx.validationRating.findMany({
    where: { session: { assessmentId, status: { not: "CANCELLED" } } },
    select: { sessionId: true, characteristicId: true, assessorId: true, level: true },
  });
  const scl = await tx.sclFulfillment.findMany({ where: { assessmentId }, select: { aspectCode: true, step: true, percent: true } });
  return {
    rows: {
      characteristics: characteristics.map((c) => ({ id: c.id, code: c.code, aspectCode: c.aspect.code, isContextual: c.isContextual })),
      strata: snapshot.strata.map((s) => ({ id: s.id, code: s.code, group: s.group, population: s.population })),
      responses: responses.map((r) => ({ stratumId: r.stratumId, answers: r.characteristicAnswers })),
      selfAssessments,
      evidenceRatings,
      validationRatings,
      scl,
      targetLevel,
    },
    params,
    parameterSnapshot: snapshot.parameters,
  };
}

export async function runScoring(actor: ScoringActor, meta: RequestMeta): Promise<{ id: string; result: EngineResult }> {
  return getDb().$transaction(async (tx) => {
    await lockStatus(tx, actor.assessmentId, RUN_STATUSES, "RUN_NOT_ALLOWED");
    const { rows, params, parameterSnapshot } = await gatherScoringRows(tx, actor.assessmentId);
    const input = buildScoringInput(rows, params);
    const result = runEngine(input.engineInput, params);
    const run = await tx.scoreRun.create({
      data: {
        assessmentId: actor.assessmentId,
        engineVersion: result.engineVersion,
        inputSnapshot: input as unknown as Prisma.InputJsonObject,
        parameterSnapshot: { engine: params, source: parameterSnapshot } as unknown as Prisma.InputJsonObject,
        result: result as unknown as Prisma.InputJsonObject,
        runById: actor.session.user.id,
      },
      select: { id: true },
    });
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "score.run",
          entityType: "ScoreRun",
          entityId: run.id,
          after: {
            engineVersion: result.engineVersion,
            organizationIndex: result.organization.index,
            indicativeLevel: result.organization.indicativeLevel,
            consolidated: result.organization.consolidated,
            sclIndicativeLevel: result.sclTrack?.indicativeLevel ?? null,
            responses: input.counts.responses,
            evidenceRatings: input.counts.evidenceRatings,
          },
        },
        meta,
      ),
    );
    return { id: run.id, result };
  });
}

export async function listScoreRuns(assessmentId: string) {
  const runs = await getDb().scoreRun.findMany({
    where: { assessmentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, engineVersion: true, isFinal: true, result: true, runBy: { select: { name: true } } },
  });
  return runs.map((r) => {
    const result = r.result as unknown as EngineResult;
    return { id: r.id, createdAt: r.createdAt, engineVersion: r.engineVersion, isFinal: r.isFinal, runByName: r.runBy.name, index: result.organization.index, level: result.organization.indicativeLevel };
  });
}

/** Waktu perubahan terakhir data yang menjadi masukan mesin, untuk memberi tahu bila eksekusi terakhir sudah usang. */
export async function lastInputChange(assessmentId: string): Promise<Date | null> {
  const db = getDb();
  const [evidence, validation, scl, selfAssessment] = await Promise.all([
    db.evidenceRating.aggregate({ where: { assessmentId }, _max: { updatedAt: true } }),
    db.validationRating.aggregate({ where: { session: { assessmentId } }, _max: { updatedAt: true } }),
    db.sclFulfillment.aggregate({ where: { assessmentId }, _max: { updatedAt: true } }),
    db.selfAssessment.aggregate({ where: { assessmentId, status: "SUBMITTED" }, _max: { submittedAt: true } }),
  ]);
  const dates = [evidence._max.updatedAt, validation._max.updatedAt, scl._max.updatedAt, selfAssessment._max.submittedAt].filter((d): d is Date => d instanceof Date);
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}

// ---------------------------------------------------------------------------
// Rapat panel
// ---------------------------------------------------------------------------

/** Eksekusi yang dibahas rapat panel: eksekusi final bila ada, selain itu eksekusi terakhir. */
async function panelRun(db: Pick<Tx, "scoreRun">, assessmentId: string) {
  return db.scoreRun.findFirst({
    where: { assessmentId },
    orderBy: [{ isFinal: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      createdAt: true,
      isFinal: true,
      finalizedAt: true,
      inputSnapshot: true,
      parameterSnapshot: true,
      result: true,
      finalResult: true,
      runBy: { select: { name: true } },
      finalizedBy: { select: { name: true } },
      panelAdjustments: {
        orderBy: { decidedAt: "asc" },
        select: { id: true, characteristicId: true, engineValue: true, adjustedValue: true, rationale: true, decidedAt: true, decidedBy: { select: { name: true } }, characteristic: { select: { code: true } } },
      },
    },
  });
}

function runParams(parameterSnapshot: unknown): EngineParameters {
  return (parameterSnapshot as { engine: EngineParameters }).engine;
}

function adjustedResult(run: { inputSnapshot: unknown; parameterSnapshot: unknown; panelAdjustments: { adjustedValue: number; characteristic: { code: string } }[] }): EngineResult {
  const input = run.inputSnapshot as unknown as ScoringInputSnapshot;
  const adjustments = Object.fromEntries(run.panelAdjustments.map((p) => [p.characteristic.code, p.adjustedValue]));
  return runEngine(withPanelAdjustments(input.engineInput, adjustments), runParams(run.parameterSnapshot));
}

export async function loadPanel(assessmentId: string) {
  const db = getDb();
  const run = await panelRun(db, assessmentId);
  if (!run) return null;
  const a = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { instrumentVersionId: true, status: true } });
  const characteristics = await instrumentCharacteristics(db, a.instrumentVersionId);
  const engine = run.result as unknown as EngineResult;
  const current = run.isFinal && run.finalResult ? (run.finalResult as unknown as EngineResult) : adjustedResult(run);
  const input = run.inputSnapshot as unknown as ScoringInputSnapshot;
  return {
    status: a.status,
    run: { id: run.id, createdAt: run.createdAt, isFinal: run.isFinal, finalizedAt: run.finalizedAt, runByName: run.runBy.name, finalizedByName: run.finalizedBy?.name ?? null },
    engine,
    current,
    sources: input.sources,
    counts: input.counts,
    strata: input.strata,
    sclComplete: input.sclComplete,
    names: Object.fromEntries(characteristics.map((c) => [c.code, c.nameId])),
    aspectNames: Object.fromEntries(characteristics.map((c) => [c.aspect.code, c.aspect.name])),
    adjustments: run.panelAdjustments.map((p) => ({
      code: p.characteristic.code,
      engineValue: p.engineValue,
      adjustedValue: p.adjustedValue,
      rationale: p.rationale,
      decidedAt: p.decidedAt,
      decidedByName: p.decidedBy.name,
    })),
  };
}

async function openPanelRun(tx: Tx, assessmentId: string) {
  await lockStatus(tx, assessmentId, PANEL_STATUSES, "PANEL_CLOSED");
  const run = await panelRun(tx, assessmentId);
  if (!run) throw new AssessmentRuleError(409, "SCORE_RUN_MISSING");
  if (run.isFinal) throw new AssessmentRuleError(409, "RESULT_FINAL");
  return run;
}

export async function savePanelAdjustment(actor: ScoringActor, input: z.output<typeof panelAdjustmentSchema>, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const run = await openPanelRun(tx, actor.assessmentId);
    const engineValue = (run.result as unknown as EngineResult).characteristics.find((c) => c.code === input.characteristicCode)?.final;
    if (engineValue === undefined) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (engineValue === null) throw new AssessmentRuleError(422, "NO_ENGINE_VALUE");
    const { instrumentVersionId } = await tx.assessment.findUniqueOrThrow({ where: { id: actor.assessmentId }, select: { instrumentVersionId: true } });
    const characteristic = await tx.characteristic.findFirstOrThrow({ where: { instrumentVersionId, code: input.characteristicCode }, select: { id: true } });
    const before = run.panelAdjustments.find((p) => p.characteristicId === characteristic.id);
    const data = { engineValue, adjustedValue: input.adjustedValue, rationale: input.rationale, decidedById: actor.session.user.id, decidedAt: new Date() };
    const saved = await tx.panelAdjustment.upsert({
      where: { scoreRunId_characteristicId: { scoreRunId: run.id, characteristicId: characteristic.id } },
      create: { scoreRunId: run.id, characteristicId: characteristic.id, ...data },
      update: data,
      select: { id: true },
    });
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "panel.adjust",
          entityType: "PanelAdjustment",
          entityId: saved.id,
          before: before ? { characteristic: input.characteristicCode, adjustedValue: before.adjustedValue, rationale: before.rationale } : null,
          after: { scoreRunId: run.id, characteristic: input.characteristicCode, engineValue, adjustedValue: input.adjustedValue, rationale: input.rationale },
        },
        meta,
      ),
    );
  });
}

export async function removePanelAdjustment(actor: ScoringActor, characteristicCode: string, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const run = await openPanelRun(tx, actor.assessmentId);
    const adjustment = run.panelAdjustments.find((p) => p.characteristic.code === characteristicCode);
    if (!adjustment) throw new AssessmentRuleError(404, "NOT_FOUND");
    await tx.panelAdjustment.delete({ where: { id: adjustment.id } });
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "panel.adjust_remove",
          entityType: "PanelAdjustment",
          entityId: adjustment.id,
          before: { scoreRunId: run.id, characteristic: characteristicCode, engineValue: adjustment.engineValue, adjustedValue: adjustment.adjustedValue, rationale: adjustment.rationale },
        },
        meta,
      ),
    );
  });
}

/** Menetapkan hasil rapat panel: hasil dengan penyesuaian disimpan sekali, lalu ScoreRun tidak dapat diubah. */
export async function finalizePanel(actor: ScoringActor, meta: RequestMeta): Promise<{ id: string; result: EngineResult }> {
  return getDb().$transaction(async (tx) => {
    const run = await openPanelRun(tx, actor.assessmentId);
    if (run.panelAdjustments.some((p) => !p.rationale.trim())) throw new AssessmentRuleError(422, "RATIONALE_REQUIRED");
    const result = adjustedResult(run);
    await tx.scoreRun.update({
      where: { id: run.id },
      data: { isFinal: true, finalResult: result as unknown as Prisma.InputJsonObject, finalizedAt: new Date(), finalizedById: actor.session.user.id },
    });
    const engine = run.result as unknown as EngineResult;
    await logAudit(
      tx,
      audit(
        actor,
        {
          action: "panel.finalize",
          entityType: "ScoreRun",
          entityId: run.id,
          after: {
            engineIndex: engine.organization.index,
            finalIndex: result.organization.index,
            indicativeLevel: result.organization.indicativeLevel,
            consolidated: result.organization.consolidated,
            adjustments: run.panelAdjustments.map((p) => ({ characteristic: p.characteristic.code, engineValue: p.engineValue, adjustedValue: p.adjustedValue })),
          },
        },
        meta,
      ),
    );
    return { id: run.id, result };
  });
}
