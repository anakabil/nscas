import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentStatus, Role, StratumGroup } from "@/generated/prisma/enums";
import type { ScoringInputSnapshot } from "@/lib/assessor-scoring/engine-input";
import { AssessmentRuleError } from "@/lib/assessments/service";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { SessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { suppressValue } from "@/lib/privacy/suppression";
import { loadParticipation } from "@/lib/respondents/participation-data";
import { perceptionGap, toEngineParameters, type EngineResult, type ParameterSnapshot } from "@/lib/scoring";
import { buildHeatmap, cronbachByDimension, rwgByUnit, type DashboardResponse, type DimensionDef } from "./analytics";

// Dasbor hasil (docs/01 M9). Semua nilai yang berasal dari jawaban survei melewati penyembunyian sel
// (CLAUDE.md aturan 3) di sini, sehingga halaman dan ekspor memakai model yang sama.
// Hak baca (docs/04): asesor Nusa Safety dan administrator klien melihat hasil draf dengan pita draf;
// koordinator unit (unitnya) dan pimpinan eksekutif hanya setelah hasil ditetapkan rapat panel.

type Tx = Prisma.TransactionClient;

export type DashboardAudience = "assessor" | "client" | "unit" | "executive";

export function audienceFor(roles: readonly Role[]): DashboardAudience | null {
  if (roles.includes("LEAD_ASSESSOR") || roles.includes("ASSESSOR")) return "assessor";
  if (roles.includes("CLIENT_ADMIN")) return "client";
  if (roles.includes("EXECUTIVE_VIEWER")) return "executive";
  if (roles.includes("UNIT_COORDINATOR")) return "unit";
  return null;
}

interface Snapshot {
  parameters: Omit<ParameterSnapshot, "aspects" | "quality"> & { aspects: (ParameterSnapshot["aspects"][number] & { name: string })[]; quality: ParameterSnapshot["quality"] & { cronbachAlphaMin?: number; rwgMin?: number } };
  strata?: { id: string; code: string; name: string; group: StratumGroup; population: number }[];
}

async function loadContext(db: Pick<Tx, "assessment">, assessmentId: string) {
  const a = await db.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: { id: true, name: true, status: true, targetLevel: true, organizationId: true, instrumentVersionId: true, periodStart: true, periodEnd: true, parameterSnapshot: true },
  });
  const snapshot = a.parameterSnapshot as unknown as Snapshot | null;
  if (!snapshot?.parameters) return null;
  const params = toEngineParameters(snapshot.parameters);
  return { assessment: a, snapshot, params, min: params.minRespondentsPerReportCell };
}

/** Hasil yang ditampilkan: hasil final rapat panel bila ada, selain itu eksekusi terakhir (draf). */
async function resultRun(assessmentId: string) {
  const run = await getDb().scoreRun.findFirst({
    where: { assessmentId },
    orderBy: [{ isFinal: "desc" }, { createdAt: "desc" }],
    select: { id: true, isFinal: true, finalizedAt: true, createdAt: true, result: true, finalResult: true, inputSnapshot: true },
  });
  if (!run) return null;
  return {
    id: run.id,
    isFinal: run.isFinal,
    finalizedAt: run.finalizedAt,
    createdAt: run.createdAt,
    result: (run.isFinal && run.finalResult ? run.finalResult : run.result) as unknown as EngineResult,
    sources: (run.inputSnapshot as unknown as ScoringInputSnapshot).sources ?? {},
  };
}

async function loadResponses(assessmentId: string, unitScope: readonly string[] | null): Promise<DashboardResponse[]> {
  const rows = await getDb().surveyResponse.findMany({
    where: { assessmentId, excluded: false, ...(unitScope ? { unitId: { in: [...unitScope] } } : {}) },
    select: {
      unitId: true,
      stratumId: true,
      characteristicAnswers: { select: { level: true, characteristic: { select: { code: true } } } },
      climateAnswers: { select: { itemId: true, value: true } },
    },
  });
  return rows.map((r) => ({
    unitId: r.unitId,
    stratumId: r.stratumId,
    answers: Object.fromEntries(r.characteristicAnswers.map((a) => [a.characteristic.code, a.level])),
    climate: Object.fromEntries(r.climateAnswers.map((a) => [a.itemId, a.value])),
  }));
}

/** Asesmen sebelumnya dari organisasi yang sama dengan versi instrumen yang sama dan hasil final. */
async function loadComparison(current: { id: string; organizationId: string; instrumentVersionId: string; periodStart: Date }) {
  const previous = await getDb().assessment.findMany({
    where: {
      organizationId: current.organizationId,
      instrumentVersionId: current.instrumentVersionId,
      id: { not: current.id },
      periodStart: { lt: current.periodStart },
      scoreRuns: { some: { isFinal: true } },
    },
    orderBy: { periodStart: "desc" },
    take: 3,
    select: { id: true, name: true, periodStart: true, periodEnd: true, scoreRuns: { where: { isFinal: true }, select: { finalResult: true } } },
  });
  return previous.map((p) => {
    const result = p.scoreRuns[0]?.finalResult as unknown as EngineResult;
    return {
      id: p.id,
      name: p.name,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      index: result.organization.index,
      level: result.organization.indicativeLevel,
      aspects: Object.fromEntries(Object.entries(result.aspects).map(([code, a]) => [code, a.index])),
    };
  });
}

export type DashboardModel = Awaited<ReturnType<typeof loadDashboard>>;

export async function loadDashboard(assessmentId: string, viewer: { roles: readonly Role[]; unitScope: readonly string[] | null }) {
  const audience = audienceFor(viewer.roles);
  const db = getDb();
  const context = await loadContext(db, assessmentId);
  const run = await resultRun(assessmentId);
  if (!audience || !context) return { available: false as const, reason: "NO_RESULT" as const };
  // Pembaca yang hanya melihat hasil final tidak perlu mengetahui apakah draf sudah ada.
  if ((audience === "executive" || audience === "unit") && !run?.isFinal) return { available: false as const, reason: "NOT_FINAL" as const };
  if (!run) return { available: false as const, reason: "NO_RESULT" as const };

  const { assessment, snapshot, params, min } = context;
  const characteristics = await db.characteristic.findMany({
    where: { instrumentVersionId: assessment.instrumentVersionId },
    orderBy: { order: "asc" },
    select: { code: true, nameId: true, isContextual: true, aspect: { select: { code: true, name: true } } },
  });
  const aspectNames = Object.fromEntries(snapshot.parameters.aspects.map((a) => [a.code, a.name]));
  const levelAspects = params.aspects.filter((a) => !a.excludedFromLevel).map((a) => ({ code: a.code, name: aspectNames[a.code] ?? a.code }));
  const { result } = run;
  const value = (c: EngineResult["characteristics"][number]) => c.panelAdjusted ?? c.final;

  const base = {
    available: true as const,
    audience,
    min,
    status: assessment.status as AssessmentStatus,
    run: { id: run.id, isFinal: run.isFinal, finalizedAt: run.finalizedAt, createdAt: run.createdAt },
    targetLevel: assessment.targetLevel,
    summary: {
      index: result.organization.index,
      level: result.organization.indicativeLevel,
      consolidated: result.organization.consolidated,
      gapToTarget: result.organization.gapToTarget,
      priorityAspect: result.organization.priorityAspect,
      priorityAspectName: aspectNames[result.organization.priorityAspect] ?? "",
      contextualIndex: result.organization.contextualIndex,
      sclLevel: result.sclTrack?.indicativeLevel ?? null,
    },
    aspects: levelAspects.map((a) => ({ code: a.code, name: a.name, index: result.aspects[a.code]?.index ?? null, gapToTarget: result.aspects[a.code]?.gapToTarget ?? null })),
    characteristics: result.characteristics.map((c) => ({
      code: c.code,
      name: characteristics.find((x) => x.code === c.code)?.nameId ?? c.code,
      aspectCode: c.aspectCode,
      isContextual: c.isContextual,
      value: value(c),
      adjusted: c.panelAdjusted !== null,
    })),
  };

  const comparisonOf = async () => {
    const previous = await loadComparison(assessment);
    return previous.length ? { previous, current: { index: result.organization.index, aspects: Object.fromEntries(levelAspects.map((a) => [a.code, result.aspects[a.code]?.index ?? null])) } } : null;
  };

  if (audience === "executive") {
    return { ...base, comparison: await comparisonOf(), heatmaps: null, divergence: null, perceptionGap: null };
  }

  const units = await db.unit.findMany({ where: { assessmentId, ...(audience === "unit" && viewer.unitScope ? { id: { in: [...viewer.unitScope] } } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const responses = await loadResponses(assessmentId, audience === "unit" ? viewer.unitScope : null);
  const defs = characteristics.map((c) => ({ code: c.code, aspectCode: c.aspect.code, isContextual: c.isContextual }));
  const unitColumns = units.filter((u) => responses.some((r) => r.unitId === u.id)).map((u) => ({ key: u.id, label: u.name, match: (r: DashboardResponse) => r.unitId === u.id }));
  const byUnit = buildHeatmap(responses, defs, levelAspects, unitColumns, min);

  if (audience === "unit") {
    return { ...base, comparison: null, heatmaps: { strata: null, units: byUnit }, divergence: null, perceptionGap: null };
  }

  const strata = snapshot.strata ?? [];
  const strataColumns = strata.map((s) => ({ key: s.id, label: `${s.code} ${s.name}`, match: (r: DashboardResponse) => r.stratumId === s.id }));
  // Rata-rata kelompok manajemen dan lapangan diterbitkan pada kesenjangan persepsi: penyembunyian pelengkap per kelompok.
  const groupKeys = (group: StratumGroup) => strata.filter((s) => s.group === group).map((s) => s.id);
  const byStratum = buildHeatmap(responses, defs, levelAspects, strataColumns, min, [groupKeys("MANAGEMENT"), groupKeys("FIELD")]);

  const stratumCode = new Map(strata.map((s) => [s.id, s.code]));
  const gap = perceptionGap(
    {
      characteristics: defs,
      strata: strata.map((s) => ({ code: s.code, group: s.group, population: s.population })),
      surveyResponses: responses.filter((r) => stratumCode.has(r.stratumId)).map((r) => ({ stratumCode: stratumCode.get(r.stratumId) as string, characteristicAnswers: r.answers })),
    },
    params,
  );

  const divergence = result.characteristics
    .filter((c) => c.flags.includes("SELISIH_PERSEPSI_BUKTI"))
    .map((c) => {
      const perception = suppressValue(c.perception, run.sources[c.code]?.surveyAnswers ?? 0, min);
      return { code: c.code, name: characteristics.find((x) => x.code === c.code)?.nameId ?? c.code, perception: perception.value, perceptionHidden: perception.value === null, evidence: c.evidence, divergence: perception.value === null ? null : c.divergence, final: value(c) };
    });

  return {
    ...base,
    comparison: await comparisonOf(),
    heatmaps: { strata: byStratum, units: byUnit },
    divergence,
    perceptionGap: levelAspects.map((a) => {
      const g = gap[a.code];
      return { code: a.code, name: a.name, management: g?.management ?? null, field: g?.field ?? null, gap: g?.gap ?? null, attention: g?.attention ?? false, suppressed: g?.suppressed ?? true };
    }),
  };
}

// ---------------------------------------------------------------------------
// Panel mutu data
// ---------------------------------------------------------------------------

/** Jawaban dapat dikeluarkan atau dipulihkan sebelum rapat panel, karena mengubah masukan mesin. */
export const EXCLUSION_STATUSES: readonly AssessmentStatus[] = ["DATA_COLLECTION", "SCORING"];

export async function loadQuality(assessmentId: string, options: { includeResponses: boolean }) {
  const db = getDb();
  const context = await loadContext(db, assessmentId);
  if (!context) return null;
  const { assessment, snapshot, min } = context;
  const quality = snapshot.parameters.quality;
  const [participation, dimensions, units, responses] = await Promise.all([
    loadParticipation(assessmentId, null),
    db.climateDimension.findMany({
      where: { instrumentVersionId: assessment.instrumentVersionId },
      orderBy: { order: "asc" },
      select: { code: true, nameId: true, items: { orderBy: { order: "asc" }, select: { id: true, reverseCoded: true } } },
    }),
    db.unit.findMany({ where: { assessmentId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    loadResponses(assessmentId, null),
  ]);
  const dims: DimensionDef[] = dimensions.map((d) => ({ code: d.code, name: d.nameId, items: d.items }));
  const alphaMin = quality.cronbachAlphaMin ?? 0.7;
  const rwgMin = quality.rwgMin ?? 0.7;
  const [excludedCount, flaggedCount] = await Promise.all([
    db.surveyResponse.count({ where: { assessmentId, excluded: true } }),
    db.surveyResponse.count({ where: { assessmentId, qualityFlags: { isEmpty: false } } }),
  ]);
  const flagged = options.includeResponses
    ? await db.surveyResponse.findMany({
        where: { assessmentId, OR: [{ qualityFlags: { isEmpty: false } }, { excluded: true }] },
        orderBy: [{ submittedOn: "desc" }, { id: "asc" }],
        take: 200,
        select: {
          id: true,
          qualityFlags: true,
          submittedOn: true,
          durationBucket: true,
          excluded: true,
          excludedReason: true,
          characteristicAnswers: { select: { level: true } },
          climateAnswers: { select: { value: true } },
        },
      })
    : [];
  return {
    status: assessment.status as AssessmentStatus,
    min,
    alphaMin,
    rwgMin,
    participation,
    alpha: cronbachByDimension(responses, dims, min, alphaMin),
    dimensions: dims.map((d) => ({ code: d.code, name: d.name })),
    rwg: rwgByUnit(responses, units, dims, min, rwgMin),
    counts: { analysed: responses.length, excluded: excludedCount, flagged: flaggedCount },
    flagged: flagged.map((r) => {
      const levels = r.characteristicAnswers.map((a) => a.level);
      const climate = r.climateAnswers.map((a) => a.value);
      const modeShare = climate.length ? Math.max(...[1, 2, 3, 4, 5].map((v) => climate.filter((x) => x === v).length)) / climate.length : null;
      return {
        id: r.id,
        flags: r.qualityFlags,
        submittedOn: r.submittedOn,
        durationBucket: r.durationBucket,
        excluded: r.excluded,
        excludedReason: r.excludedReason,
        dontKnowShare: levels.length ? levels.filter((l) => l === null).length / levels.length : null,
        climateModeShare: modeShare,
      };
    }),
  };
}

export interface ExclusionActor {
  session: SessionContext;
  assessmentId: string;
  organizationId: string;
  roles: Role[];
}

/** Mengeluarkan atau memulihkan satu respons survei dengan alasan; hanya asesor, tercatat di jejak audit. */
export async function setResponseExclusion(actor: ExclusionActor, responseId: string, input: { excluded: boolean; reason: string }, meta: RequestMeta): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: AssessmentStatus }[]>`SELECT "status" FROM "Assessment" WHERE "id" = ${actor.assessmentId} FOR UPDATE`;
    if (!rows[0]) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (!EXCLUSION_STATUSES.includes(rows[0].status)) throw new AssessmentRuleError(409, "EXCLUSION_CLOSED", { status: rows[0].status });
    const response = await tx.surveyResponse.findFirst({ where: { id: responseId, assessmentId: actor.assessmentId }, select: { id: true, excluded: true, excludedReason: true } });
    if (!response) throw new AssessmentRuleError(404, "NOT_FOUND");
    if (response.excluded === input.excluded) throw new AssessmentRuleError(409, "NO_CHANGE");
    await tx.surveyResponse.update({
      where: { id: responseId },
      data: input.excluded ? { excluded: true, excludedReason: input.reason, excludedById: actor.session.user.id } : { excluded: false, excludedReason: null, excludedById: null },
    });
    await logAudit(tx, {
      action: input.excluded ? "survey.exclude" : "survey.restore",
      entityType: "SurveyResponse",
      entityId: responseId,
      actor: { id: actor.session.user.id, role: actor.roles[0] ?? null },
      organizationId: actor.organizationId,
      assessmentId: actor.assessmentId,
      before: { excluded: response.excluded, reason: response.excludedReason },
      after: { excluded: input.excluded, reason: input.reason },
      meta,
    });
  });
}
