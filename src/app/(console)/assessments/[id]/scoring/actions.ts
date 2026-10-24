"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { evidenceRatingSchema, issueCode, sclAspectSchema } from "@/lib/assessor-scoring/rules";
import { runScoring, saveEvidenceRating, saveSclAspect } from "@/lib/assessor-scoring/service";
import { requireRole } from "@/lib/auth/guard";
import { SCORING_ROLES } from "@/lib/auth/roles";
import { formatNumber } from "@/lib/format";
import { getRequestMeta } from "@/lib/request-meta";

// Server Action penilaian asesor (docs/01 M8). Setiap asesor menyimpan nilai buktinya sendiri; asesor utama
// mengisi jalur setara Safety Culture Ladder dan menjalankan mesin penilaian.

const idSchema = z.string().min(1).max(64);
const codeSchema = z.string().regex(/^K[0-9T]+\.\d+$/);

function refresh(assessmentId: string) {
  revalidatePath(`/assessments/${assessmentId}`, "layout");
}

export async function saveEvidenceRatingAction(assessmentId: string, characteristicCode: string, input: unknown): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), SCORING_ROLES.rate);
    const parsed = evidenceRatingSchema.safeParse(input);
    if (!parsed.success) return { error: issueCode(parsed.error, { level: "INVALID_RATING", rationale: "RATIONALE_TOO_SHORT" }) };
    await saveEvidenceRating(access, codeSchema.parse(characteristicCode), parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function saveSclAspectAction(assessmentId: string, input: unknown): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), SCORING_ROLES.scl);
    const parsed = sclAspectSchema.safeParse(input);
    if (!parsed.success) return { error: issueCode(parsed.error, { percent: "INVALID_PERCENT", justification: "JUSTIFICATION_TOO_SHORT" }) };
    await saveSclAspect(access, parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function runScoringAction(assessmentId: string): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), SCORING_ROLES.run);
    const { result } = await runScoring(access, await getRequestMeta());
    refresh(assessmentId);
    return { success: "RUN", details: [formatNumber(result.organization.index, 2)] };
  } catch (error) {
    return actionErrorState(error);
  }
}
