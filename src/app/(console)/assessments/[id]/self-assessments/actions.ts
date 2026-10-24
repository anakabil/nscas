"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";
import { issueSchema } from "@/lib/self-assessment/rules";
import { issueSelfAssessment, reissueSelfAssessment, revokeSelfAssessment } from "@/lib/self-assessment/service";

// Penerbitan tautan penilaian mandiri oleh administrator klien (docs/04 bagian 2: token ditulis CLIENT_ADMIN).

const idSchema = z.string().min(1).max(64);

export interface IssueState {
  error?: string;
  success?: string;
  link?: string;
  name?: string;
}

async function actor(assessmentId: string) {
  return requireRole(idSchema.parse(assessmentId), rolesFor("tokensAndParticipation", "write"));
}

export async function issueSelfAssessmentAction(assessmentId: string, _prev: IssueState, formData: FormData): Promise<IssueState> {
  try {
    const access = await actor(assessmentId);
    const parsed = issueSchema.safeParse({ name: formData.get("name"), position: formData.get("position"), unitId: formData.get("unitId") });
    if (!parsed.success) return { error: "INVALID_INPUT" };
    const { link } = await issueSelfAssessment(access, parsed.data, await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}/self-assessments`);
    return { link, name: parsed.data.name };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function revokeSelfAssessmentAction(assessmentId: string, selfAssessmentId: string): Promise<IssueState> {
  try {
    const access = await actor(assessmentId);
    await revokeSelfAssessment(access, idSchema.parse(selfAssessmentId), await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}/self-assessments`);
    return { success: "REVOKED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function reissueSelfAssessmentAction(assessmentId: string, selfAssessmentId: string): Promise<IssueState> {
  try {
    const access = await actor(assessmentId);
    const { link } = await reissueSelfAssessment(access, idSchema.parse(selfAssessmentId), await getRequestMeta());
    revalidatePath(`/assessments/${assessmentId}/self-assessments`);
    return { link };
  } catch (error) {
    return actionErrorState(error);
  }
}
