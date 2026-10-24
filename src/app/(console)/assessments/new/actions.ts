"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { createAssessment, parseAssessmentDetails } from "@/lib/assessments/service";
import { requireOrganizationRole } from "@/lib/auth/guard";
import { ASSESSMENT_CREATE_ROLES } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";

export async function createAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = z.string().min(1).max(64).safeParse(formData.get("organizationId"));
  if (!organizationId.success) return { error: "INVALID_INPUT" };
  let id: string;
  try {
    const access = await requireOrganizationRole(organizationId.data, ASSESSMENT_CREATE_ROLES);
    const parsed = parseAssessmentDetails(Object.fromEntries(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues.some((i) => i.message === "PERIOD_ORDER") ? "PERIOD_ORDER" : "INVALID_INPUT" };
    }
    ({ id } = await createAssessment(access, parsed.data, await getRequestMeta()));
  } catch (error) {
    return actionErrorState(error);
  }
  redirect(`/assessments/${id}`);
}
