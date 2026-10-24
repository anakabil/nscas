"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { destructionSchema, executeDestruction } from "@/lib/retention/service";

// Server Action pemusnahan data mentah oleh SUPER_ADMIN (docs/04 bagian 7).

const idSchema = z.string().min(1).max(64);

export async function destroyRawDataAction(assessmentId: string, input: unknown): Promise<ActionState> {
  try {
    const session = await requireSuperAdmin();
    const parsed = destructionSchema.safeParse(input);
    if (!parsed.success) return { error: "DESTRUCTION_INVALID" };
    const recordId = await executeDestruction(session, idSchema.parse(assessmentId), parsed.data, await getRequestMeta());
    revalidatePath("/retention");
    return { success: "DESTROYED", details: [recordId] };
  } catch (error) {
    return actionErrorState(error);
  }
}
