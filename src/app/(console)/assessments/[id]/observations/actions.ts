"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { parseDecimal } from "@/lib/assessments/parameters";
import { requireRole } from "@/lib/auth/guard";
import { OBSERVATION_WINDOW_WRITE_ROLES } from "@/lib/auth/roles";
import { createObservationWindow, windowSchema } from "@/lib/observations/service";
import { getRequestMeta } from "@/lib/request-meta";

const idSchema = z.string().min(1).max(64);

/** Jendela observasi dibuat asesor yang ditugaskan (docs/01 M6). */
export async function createWindowAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), OBSERVATION_WINDOW_WRITE_ROLES);
    const parsed = windowSchema.safeParse({
      unitId: formData.get("unitId"),
      title: formData.get("title"),
      opensAt: formData.get("opensAt"),
      closesAt: formData.get("closesAt"),
      checklist: formData.get("checklist") ?? "",
      latitude: parseDecimal(formData.get("latitude")),
      longitude: parseDecimal(formData.get("longitude")),
      radiusMeters: parseDecimal(formData.get("radiusMeters")),
    });
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).find((m) => m === "WINDOW_ORDER" || m === "CHECKLIST_REQUIRED");
      return { error: message ?? "INVALID_INPUT" };
    }
    await createObservationWindow(access, parsed.data, await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}/observations`);
    return { success: "CREATED" };
  } catch (error) {
    return actionErrorState(error);
  }
}
