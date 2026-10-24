"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole } from "@/lib/auth/guard";
import { REPORT_ROLES } from "@/lib/auth/roles";
import { createReportVersion, finalizeReportVersion } from "@/lib/report/service";
import { getRequestMeta } from "@/lib/request-meta";

// Server Action pelaporan (docs/01 M11): penyusunan versi dan finalisasi dengan tanda tangan lead assessor.

const idSchema = z.string().min(1).max(64);
const finalizeSchema = z.object({ version: z.number().int().min(1), position: z.string().trim().min(2).max(200), confirmed: z.literal(true) });

export async function createReportVersionAction(assessmentId: string): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), REPORT_ROLES.write);
    const version = await createReportVersion(access, await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}`, "layout");
    return { success: "CREATED", details: [String(version)] };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function finalizeReportAction(assessmentId: string, input: unknown): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), REPORT_ROLES.write);
    const parsed = finalizeSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "position") ? "POSITION_REQUIRED" : "INVALID_INPUT" };
    await finalizeReportVersion(access, parsed.data.version, parsed.data.position, await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}`, "layout");
    return { success: "FINALIZED", details: [String(parsed.data.version)] };
  } catch (error) {
    return actionErrorState(error);
  }
}
