import "server-only";
import { loadActionPlan } from "@/lib/action-plan/service";
import { loadPanel } from "@/lib/assessor-scoring/service";
import { loadDashboard, loadQuality } from "@/lib/dashboard/service";
import { getDb } from "@/lib/db";
import { listEvidence } from "@/lib/evidence/service";
import { suppressValue } from "@/lib/privacy/suppression";
import { aspectWeights, toEngineParameters, type ParameterSnapshot, type SamplePlan } from "@/lib/scoring";
import type { ReportContent, ReportLimitation } from "./types";

// Penyusunan snapshot isi laporan (docs/01 bagian 6) dari data asesmen yang hasilnya sudah ditetapkan rapat panel.
// Memakai model dasbor, panel mutu, rapat panel, dan rencana aksi yang sama, sehingga aturan penyembunyian sel
// berlaku seragam di dasbor, ekspor, dan laporan (CLAUDE.md aturan 3).

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function buildReportContent(assessmentId: string, version: number, now: Date = new Date()): Promise<ReportContent> {
  const db = getDb();
  const assessment = await db.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      name: true,
      scopeType: true,
      periodStart: true,
      periodEnd: true,
      targetLevel: true,
      surveyOpensAt: true,
      surveyClosesAt: true,
      lockedAt: true,
      parameterSnapshot: true,
      instrumentVersion: { select: { code: true } },
      organization: { select: { name: true, legalName: true, sector: true } },
    },
  });
  const snapshot = assessment.parameterSnapshot as unknown as {
    parameters: Omit<ParameterSnapshot, "aspects"> & { aspects: (ParameterSnapshot["aspects"][number] & { name: string })[] };
    samplePlan?: { projects: number; locations: number; result: SamplePlan<{ code: string; name: string; population: number }> } | null;
  };
  const params = toEngineParameters(snapshot.parameters);
  const weights = aspectWeights(params);

  const [panel, dashboard, quality, plan, units, sessions, evidence] = [
    await loadPanel(assessmentId),
    await loadDashboard(assessmentId, { roles: ["LEAD_ASSESSOR"], unitScope: null }),
    await loadQuality(assessmentId, { includeResponses: false }),
    await loadActionPlan(assessmentId, null, now),
    await db.unit.findMany({ where: { assessmentId }, orderBy: { name: "asc" }, select: { name: true, type: true, parent: { select: { name: true } } } }),
    await db.validationSession.findMany({
      where: { assessmentId, status: { not: "CANCELLED" } },
      orderBy: [{ scheduledAt: "asc" }, { label: "asc" }],
      select: { label: true, type: true, scheduledAt: true, participants: { orderBy: { fullName: "asc" }, select: { fullName: true, position: true } } },
    }),
    await listEvidence(assessmentId, null),
  ];
  if (!panel?.run.isFinal || !dashboard.available || !quality) throw new Error("Report content requires a final result");

  const min = params.minRespondentsPerReportCell;
  const { current, engine, sources } = panel;
  const aspectName = (code: string) => snapshot.parameters.aspects.find((a) => a.code === code)?.name ?? code;
  const characteristics = current.characteristics.map((c) => {
    const p = suppressValue(c.perception, sources[c.code]?.surveyAnswers ?? 0, min);
    return {
      code: c.code,
      name: panel.names[c.code] ?? c.code,
      aspectCode: c.aspectCode,
      isContextual: c.isContextual,
      perception: p.value,
      perceptionHidden: c.perception !== null && p.value === null,
      evidence: c.evidence,
      validation: c.validation,
      combined: c.combined,
      final: c.final,
      panelAdjusted: c.panelAdjusted,
      divergence: p.value === null ? null : c.divergence,
      flags: c.flags,
    };
  });

  const limitations: ReportLimitation[] = [{ code: "SELF_REPORT" }, { code: "CROSS_SECTIONAL" }, { code: "ONLINE_VALIDATION" }, { code: "EVIDENCE_PROVIDED" }];
  const push = (code: string, items: string[]) => items.length && limitations.push({ code, items });
  push("LOW_PARTICIPATION", quality.participation.summary.strata.filter((s) => s.belowMinimum).map((s) => `${s.code} ${s.name}`));
  push("LOW_ALPHA", quality.alpha.filter((a) => a.belowThreshold).map((a) => `${a.code} ${a.name}`));
  push("LOW_RWG", quality.rwg.filter((u) => u.belowThreshold).map((u) => u.name));
  push("INCOMPLETE_LAYERS", characteristics.filter((c) => c.flags.includes("LAPISAN_TIDAK_LENGKAP")).map((c) => c.code));
  push("SINGLE_RATER", characteristics.filter((c) => c.flags.includes("PENILAI_TUNGGAL")).map((c) => c.code));
  const hiddenCells = (dashboard.heatmaps?.strata?.rows ?? []).flatMap((r) => r.cells).some((c) => c.state === "suppressed" || c.state === "secondary");
  if (hiddenCells || characteristics.some((c) => c.perceptionHidden) || dashboard.perceptionGap?.some((g) => g.suppressed)) limitations.push({ code: "SUPPRESSED_CELLS" });
  if (!current.sclTrack) limitations.push({ code: "SCL_INCOMPLETE" });

  const plan_ = snapshot.samplePlan;
  return {
    schemaVersion: 1,
    version,
    generatedAt: now.toISOString(),
    organization: assessment.organization,
    assessment: {
      name: assessment.name,
      scopeType: assessment.scopeType,
      periodStart: assessment.periodStart.toISOString(),
      periodEnd: assessment.periodEnd.toISOString(),
      targetLevel: assessment.targetLevel,
      instrumentVersion: assessment.instrumentVersion.code,
      surveyOpensAt: iso(assessment.surveyOpensAt),
      surveyClosesAt: iso(assessment.surveyClosesAt),
      lockedAt: iso(assessment.lockedAt),
    },
    units: units.map((u) => ({ name: u.name, type: u.type, parentName: u.parent?.name ?? null })),
    method: {
      layerWeights: params.layerWeights,
      selfAssessmentWeight: params.selfAssessmentWeightInPerception,
      divergenceThreshold: params.divergenceThreshold,
      assessorDisagreementFlag: params.assessorDisagreementFlag,
      consolidation: params.consolidation,
      perceptionGapAttention: params.perceptionGapAttention,
      minCell: min,
      aspects: [...weights].map(([code, weight]) => ({ code, name: aspectName(code), weight })),
      sclThresholds: params.sclThresholds,
      samplePlan: plan_?.result
        ? {
            workers: plan_.result.inputs.M,
            projects: plan_.projects,
            locations: plan_.locations,
            surveyRecommended: plan_.result.recommendedSurvey,
            surveyTargetTotal: plan_.result.surveyTargetTotal,
            interviewsManagement: plan_.result.sclMinimumInterviewManagement,
            interviewsOperational: plan_.result.sclMinimumInterviewOperational,
            projectsToVisit: plan_.result.projectsToVisit,
            strata: plan_.result.strata.map((s) => ({ code: s.code, name: s.name, population: s.population, target: s.surveyTarget })),
          }
        : null,
      counts: panel.counts,
    },
    participation: {
      minParticipation: quality.participation.minParticipation,
      strata: quality.participation.summary.strata.map((s) => ({ code: s.code, name: s.name, population: s.population, completed: s.completed.value, rate: s.rate, belowMinimum: s.belowMinimum })),
      units: quality.participation.summary.units.map((u) => ({ name: u.name, completed: u.completed.value, rate: u.rate })),
      totals: { population: quality.participation.summary.totals.population, completed: quality.participation.summary.totals.completed.value, rate: quality.participation.summary.totals.rate },
    },
    reliability: {
      alphaMin: quality.alphaMin,
      rwgMin: quality.rwgMin,
      alpha: quality.alpha.map((a) => ({ code: a.code, name: a.name, value: a.alpha.value, n: a.alpha.n, below: a.belowThreshold })),
      rwg: quality.rwg.map((u) => ({ name: u.name, value: u.average, n: u.n, below: u.belowThreshold })),
    },
    result: {
      finalizedAt: iso(panel.run.finalizedAt),
      finalizedBy: panel.run.finalizedByName,
      organization: {
        index: current.organization.index,
        engineIndex: engine.organization.index,
        indicativeLevel: current.organization.indicativeLevel,
        consolidated: current.organization.consolidated,
        gapToTarget: current.organization.gapToTarget,
        priorityAspect: current.organization.priorityAspect,
        contextualIndex: current.organization.contextualIndex,
        minAspectIndex: current.organization.minAspectIndex,
        minCharacteristicIndex: current.organization.minCharacteristicIndex,
      },
      aspects: Object.entries(current.aspects).map(([code, a]) => ({ code, name: aspectName(code), weight: a.weight, index: a.index, engineIndex: engine.aspects[code]?.index ?? a.index, gapToTarget: a.gapToTarget })),
      characteristics,
      sclTrack: current.sclTrack
        ? {
            indicativeLevel: current.sclTrack.indicativeLevel,
            steps: ([2, 3, 4, 5] as const).map((step) => ({ step, weightedAverage: current.sclTrack!.steps[step].weightedAverage, minimum: current.sclTrack!.steps[step].minimum, passed: current.sclTrack!.steps[step].passed })),
          }
        : null,
    },
    perceptionGap: dashboard.perceptionGap ?? [],
    strataHeatmap: dashboard.heatmaps?.strata ?? null,
    panel: panel.adjustments.map((a) => ({ code: a.code, name: panel.names[a.code] ?? a.code, engineValue: a.engineValue, adjustedValue: a.adjustedValue, rationale: a.rationale, decidedBy: a.decidedByName, decidedAt: a.decidedAt.toISOString() })),
    gaps: plan.gaps.map((g) => ({
      rank: g.rank,
      code: g.characteristic.code,
      name: g.characteristic.nameId,
      aspectCode: g.characteristic.aspect.code,
      currentIndex: g.currentIndex,
      gap: g.gap,
      priorityScore: g.priorityScore,
      isContextual: g.isContextual,
      priority: g.priority,
      rootCause: g.rootCause,
      actions: g.actions
        .filter((a) => a.status !== "CANCELLED")
        .map((a) => ({ title: a.title, owner: a.ownerName, position: a.ownerPosition, unit: a.unit?.name ?? null, dueDate: a.dueDate.toISOString().slice(0, 10), indicator: a.successIndicator, status: a.status })),
    })),
    limitations,
    appendices: {
      participants: sessions.filter((s) => s.participants.length > 0).map((s) => ({ session: s.label, type: s.type, scheduledAt: iso(s.scheduledAt), people: s.participants })),
      evidence: evidence.map((e) => ({ title: e.title, unit: e.unitName, version: e.version, mimeType: e.mimeType, codes: e.characteristicCodes, sha256: e.sha256, uploadedAt: e.createdAt.toISOString() })),
      parameters: JSON.parse(JSON.stringify(snapshot.parameters)) as Record<string, unknown>,
    },
  };
}
