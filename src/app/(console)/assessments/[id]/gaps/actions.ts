"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionSchema, gapAnalysisSchema, progressSchema, verificationSchema } from "@/lib/action-plan/rules";
import { addProgress, createAction, generateGapList, publishActionPlan, updateAction, updateGapAnalysis, verifyAction } from "@/lib/action-plan/service";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole } from "@/lib/auth/guard";
import { ACTION_PLAN_ROLES } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";

// Server Action daftar kesenjangan dan rencana aksi (docs/01 M10). Hak akses diperiksa di server; koordinator unit
// dibatasi ke tindakan unitnya oleh layanan.

const idSchema = z.string().min(1).max(64);

function refresh(assessmentId: string) {
  revalidatePath(`/assessments/${assessmentId}`, "layout");
}

async function run(assessmentId: string, roles: readonly string[], fn: (access: Awaited<ReturnType<typeof requireRole>>) => Promise<ActionState>): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), roles as Parameters<typeof requireRole>[1]);
    const result = await fn(access);
    if (result.success) refresh(assessmentId);
    return result;
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function generateGapListAction(assessmentId: string): Promise<ActionState> {
  return run(assessmentId, ACTION_PLAN_ROLES.generate, async (access) => {
    const count = await generateGapList(access, await getRequestMeta());
    return { success: "GENERATED", details: [String(count)] };
  });
}

export async function updateGapAnalysisAction(assessmentId: string, gapId: string, input: unknown): Promise<ActionState> {
  return run(assessmentId, ACTION_PLAN_ROLES.analyse, async (access) => {
    const parsed = gapAnalysisSchema.safeParse(input);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await updateGapAnalysis(access, idSchema.parse(gapId), parsed.data, await getRequestMeta());
    return { success: "SAVED" };
  });
}

export async function saveActionAction(assessmentId: string, target: { gapId?: string; actionId?: string }, input: unknown): Promise<ActionState> {
  return run(assessmentId, ACTION_PLAN_ROLES.act, async (access) => {
    const parsed = actionSchema.safeParse(input);
    if (!parsed.success) return { error: "ACTION_INVALID" };
    if (target.actionId) {
      await updateAction(access, idSchema.parse(target.actionId), parsed.data, await getRequestMeta());
      return { success: "SAVED" };
    }
    await createAction(access, idSchema.parse(target.gapId), parsed.data, await getRequestMeta());
    return { success: "CREATED" };
  });
}

export async function addProgressAction(assessmentId: string, actionId: string, input: unknown): Promise<ActionState> {
  return run(assessmentId, ACTION_PLAN_ROLES.act, async (access) => {
    const parsed = progressSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "note") ? "NOTE_TOO_SHORT" : "INVALID_INPUT" };
    await addProgress(access, idSchema.parse(actionId), parsed.data, await getRequestMeta());
    return { success: "SAVED" };
  });
}

export async function verifyActionAction(assessmentId: string, actionId: string, input: unknown): Promise<ActionState> {
  return run(assessmentId, ACTION_PLAN_ROLES.verify, async (access) => {
    const parsed = verificationSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "note") ? "NOTE_TOO_SHORT" : "INVALID_INPUT" };
    await verifyAction(access, idSchema.parse(actionId), parsed.data, await getRequestMeta());
    return { success: "VERIFIED" };
  });
}

export async function publishActionPlanAction(assessmentId: string): Promise<ActionState> {
  return run(assessmentId, ACTION_PLAN_ROLES.publish, async (access) => {
    await publishActionPlan(access, await getRequestMeta());
    return { success: "PUBLISHED" };
  });
}
