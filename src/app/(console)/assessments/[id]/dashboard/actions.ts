"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole } from "@/lib/auth/guard";
import { DASHBOARD_ROLES } from "@/lib/auth/roles";
import { setResponseExclusion } from "@/lib/dashboard/service";
import { getRequestMeta } from "@/lib/request-meta";

// Mengeluarkan atau memulihkan jawaban survei bertanda (docs/03 bagian 8): hanya asesor, dengan alasan, tercatat
// di jejak audit.

const idSchema = z.string().min(1).max(64);
const exclusionSchema = z.object({ responseId: z.uuid(), excluded: z.boolean(), reason: z.string().trim().min(10).max(1000) });

export async function setExclusionAction(assessmentId: string, input: unknown): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), DASHBOARD_ROLES.exclude);
    const parsed = exclusionSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "reason") ? "REASON_TOO_SHORT" : "INVALID_INPUT" };
    await setResponseExclusion(access, parsed.data.responseId, { excluded: parsed.data.excluded, reason: parsed.data.reason }, await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}/dashboard`, "layout");
    return { success: parsed.data.excluded ? "EXCLUDED" : "RESTORED" };
  } catch (error) {
    return actionErrorState(error);
  }
}
