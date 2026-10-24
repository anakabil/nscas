"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { issueCode, panelAdjustmentSchema } from "@/lib/assessor-scoring/rules";
import { finalizePanel, removePanelAdjustment, savePanelAdjustment } from "@/lib/assessor-scoring/service";
import { requireRole } from "@/lib/auth/guard";
import { SCORING_ROLES } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";

// Server Action rapat panel asesor (docs/01 M8): penyesuaian nilai akhir dengan alasan wajib dan penetapan hasil.

const idSchema = z.string().min(1).max(64);
const codeSchema = z.string().regex(/^K[0-9T]+\.\d+$/);

function refresh(assessmentId: string) {
  revalidatePath(`/assessments/${assessmentId}`, "layout");
}

export async function savePanelAdjustmentAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), SCORING_ROLES.panelWrite);
    const parsed = panelAdjustmentSchema.safeParse({
      characteristicCode: formData.get("characteristicCode"),
      adjustedValue: String(formData.get("adjustedValue") ?? "").replace(",", "."),
      rationale: formData.get("rationale"),
    });
    if (!parsed.success) return { error: issueCode(parsed.error, { adjustedValue: "INVALID_PANEL_VALUE", rationale: "RATIONALE_TOO_SHORT" }) };
    await savePanelAdjustment(access, parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function removePanelAdjustmentAction(assessmentId: string, characteristicCode: string): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), SCORING_ROLES.panelWrite);
    await removePanelAdjustment(access, codeSchema.parse(characteristicCode), await getRequestMeta());
    refresh(assessmentId);
    return { success: "REMOVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function finalizePanelAction(assessmentId: string, confirmed: boolean): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), SCORING_ROLES.panelWrite);
    if (confirmed !== true) return { error: "INVALID_INPUT" };
    await finalizePanel(access, await getRequestMeta());
    refresh(assessmentId);
    return { success: "FINALIZED" };
  } catch (error) {
    return actionErrorState(error);
  }
}
