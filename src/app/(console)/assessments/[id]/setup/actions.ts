"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { editableParametersSchema, parseDecimal } from "@/lib/assessments/parameters";
import { CONFIGURATION_WRITE_ROLES } from "@/lib/assessments/permissions";
import {
  addAssignment,
  createStratum,
  createUnit,
  deleteStratum,
  deleteUnit,
  parseAssessmentDetails,
  removeAssignment,
  samplePlanInputSchema,
  saveSamplePlan,
  stratumSchema,
  transitionAssessment,
  unitSchema,
  updateAssessmentDetails,
  updateParameters,
  updateStrataPopulations,
  updateStratum,
  updateUnit,
} from "@/lib/assessments/service";
import { STATUS_ORDER } from "@/lib/assessments/state-machine";
import { requireRole } from "@/lib/auth/guard";
import { ASSESSMENT_TEAM_ROLES } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";

// Server Action konfigurasi asesmen. Setiap aksi memanggil requireRole lebih dulu; layanan memeriksa
// status (409 bila sudah dikunci) dan mencatat jejak audit dalam transaksi yang sama.

const idSchema = z.string().min(1).max(64);

async function configurationActor(assessmentId: string) {
  return requireRole(idSchema.parse(assessmentId), CONFIGURATION_WRITE_ROLES);
}

function done(assessmentId: string): ActionState {
  revalidatePath(`/assessments/${assessmentId}`, "layout");
  return { success: "SAVED" };
}

export async function updateDetailsAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const parsed = parseAssessmentDetails(Object.fromEntries(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues.some((i) => i.message === "PERIOD_ORDER") ? "PERIOD_ORDER" : "INVALID_INPUT" };
    }
    await updateAssessmentDetails(actor, parsed.data, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

function unitFromForm(formData: FormData) {
  const numberOrEmpty = (name: string) => {
    const raw = formData.get(name);
    if (typeof raw !== "string" || raw.trim() === "") return "";
    return parseDecimal(raw) ?? Number.NaN;
  };
  return unitSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    parentId: formData.get("parentId"),
    latitude: numberOrEmpty("latitude"),
    longitude: numberOrEmpty("longitude"),
    radiusMeters: numberOrEmpty("radiusMeters"),
  });
}

function unitErrorCode(issues: { message: string }[]): string {
  return issues.some((i) => i.message === "COORDINATES_INCOMPLETE") ? "COORDINATES_INCOMPLETE" : "INVALID_INPUT";
}

export async function createUnitAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const parsed = unitFromForm(formData);
    if (!parsed.success) return { error: unitErrorCode(parsed.error.issues) };
    await createUnit(actor, parsed.data, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updateUnitAction(assessmentId: string, unitId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const parsed = unitFromForm(formData);
    if (!parsed.success) return { error: unitErrorCode(parsed.error.issues) };
    await updateUnit(actor, idSchema.parse(unitId), parsed.data, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function deleteUnitAction(assessmentId: string, unitId: string): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    await deleteUnit(actor, idSchema.parse(unitId), await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

function stratumFromForm(formData: FormData) {
  return stratumSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    group: formData.get("group"),
    population: formData.get("population") || 0,
    isContractor: formData.get("isContractor") === "on",
  });
}

export async function createStratumAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const parsed = stratumFromForm(formData);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await createStratum(actor, parsed.data, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updateStratumAction(assessmentId: string, stratumId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const parsed = stratumFromForm(formData);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await updateStratum(actor, idSchema.parse(stratumId), parsed.data, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function deleteStratumAction(assessmentId: string, stratumId: string): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    await deleteStratum(actor, idSchema.parse(stratumId), await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updatePopulationsAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const entries = [...formData.entries()].filter(([key]) => key.startsWith("population:"));
    const populations: Record<string, number> = {};
    for (const [key, value] of entries) {
      const parsed = z.coerce.number().int().min(0).max(10_000_000).safeParse(typeof value === "string" ? value.replace(/[.,\s]/g, "") : value);
      if (!parsed.success) return { error: "INVALID_INPUT" };
      populations[idSchema.parse(key.slice("population:".length))] = parsed.data;
    }
    await updateStrataPopulations(actor, populations, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updateParametersAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const d = (name: string) => parseDecimal(formData.get(name)) ?? Number.NaN;
    const parsed = editableParametersSchema.safeParse({
      layerWeights: { perception: d("layerWeights.perception"), evidence: d("layerWeights.evidence"), validation: d("layerWeights.validation") },
      selfAssessmentWeightInPerception: d("selfAssessmentWeightInPerception"),
      divergenceThreshold: d("divergenceThreshold"),
      consolidation: { maxAspectBelowLevel: d("consolidation.maxAspectBelowLevel"), maxCharacteristicBelowLevel: d("consolidation.maxCharacteristicBelowLevel") },
      perceptionGapAttention: d("perceptionGapAttention"),
      assessorDisagreementFlag: d("assessorDisagreementFlag"),
      sclThresholds: [2, 3, 4, 5].map((step) => ({ step, minWeightedAverage: d(`scl.${step}.minWeightedAverage`), minPerAspect: d(`scl.${step}.minPerAspect`) })),
      quality: { cronbachAlphaMin: d("quality.cronbachAlphaMin"), rwgMin: d("quality.rwgMin"), minRespondentsPerReportCell: d("quality.minRespondentsPerReportCell") },
      sampling: { z: d("sampling.z"), marginOfError: d("sampling.marginOfError"), proportion: d("sampling.proportion"), minParticipationPerStratum: d("sampling.minParticipationPerStratum") },
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.some((i) => i.message === "LAYER_WEIGHTS_SUM") ? "LAYER_WEIGHTS_SUM" : "INVALID_INPUT" };
    }
    const text = (name: string) => z.string().max(5_000).parse(formData.get(name) ?? "");
    await updateParameters(
      actor,
      { parameters: parsed.data, consentTextId: text("consentTextId"), consentTextEn: text("consentTextEn"), dpaSigned: formData.get("dpaSigned") === "on" },
      await getRequestMeta(),
    );
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function saveSamplePlanAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await configurationActor(assessmentId);
    const parsed = samplePlanInputSchema.safeParse({ projects: formData.get("projects"), locations: formData.get("locations") });
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await saveSamplePlan(actor, parsed.data, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function addAssignmentAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole(idSchema.parse(assessmentId), ASSESSMENT_TEAM_ROLES.write);
    const parsed = z
      .object({ userId: idSchema, role: z.enum(["LEAD_ASSESSOR", "ASSESSOR"]) })
      .safeParse({ userId: formData.get("userId"), role: formData.get("role") });
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await addAssignment(actor, parsed.data, await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function removeAssignmentAction(assessmentId: string, assignmentId: string): Promise<ActionState> {
  try {
    const actor = await requireRole(idSchema.parse(assessmentId), ASSESSMENT_TEAM_ROLES.write);
    await removeAssignment(actor, idSchema.parse(assignmentId), await getRequestMeta());
    return done(assessmentId);
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function transitionAction(assessmentId: string, to: string): Promise<ActionState> {
  try {
    const target = z.enum(STATUS_ORDER as [string, ...string[]]).parse(to) as (typeof STATUS_ORDER)[number];
    // Peran pelaku untuk transisi tertentu diperiksa lagi oleh layanan berdasarkan status saat ini.
    const actor = await requireRole(idSchema.parse(assessmentId), ["LEAD_ASSESSOR", "SUPER_ADMIN"]);
    await transitionAssessment(actor, target, await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}`, "layout");
    return { success: "TRANSITIONED" };
  } catch (error) {
    return actionErrorState(error);
  }
}
