"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole } from "@/lib/auth/guard";
import { VALIDATION_ROLES } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";
import {
  addParticipant,
  assessorFormSchema,
  createSession,
  createSessionsFromProposal,
  guideSchema,
  participantSchema,
  removeParticipant,
  saveAssessorForm,
  sessionSchema,
  sessionUpdateSchema,
  updateGuideTemplate,
  updateSession,
} from "@/lib/validation/service";

// Server Action validasi daring (docs/01 M7). Asesor utama menjadwalkan sesi dan mengubah panduan; asesor yang
// ditugaskan mengisi formulir dan daftar narasumber.

const idSchema = z.string().min(1).max(64);

function refresh(assessmentId: string) {
  revalidatePath(`/assessments/${assessmentId}/validation`, "layout");
}

function sessionFields(formData: FormData) {
  return {
    type: formData.get("type"),
    label: formData.get("label"),
    unitId: formData.get("unitId"),
    stratumId: formData.get("stratumId"),
    scheduledAt: formData.get("scheduledAt"),
    meetingUrl: formData.get("meetingUrl"),
    participantCount: formData.get("participantCount") ?? "",
    guideLayer: formData.get("guideLayer"),
    status: formData.get("status"),
  };
}

export async function createSessionsFromProposalAction(assessmentId: string): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), VALIDATION_ROLES.schedule);
    const t = await getTranslations("validation");
    const count = await createSessionsFromProposal(
      access,
      (s) =>
        s.stratumCode
          ? t("sessionLabel", { type: t(`typeShort.${s.type}`), stratum: s.stratumCode, sequence: s.sequence })
          : t("sessionLabelNoStratum", { type: t(`typeShort.${s.type}`), sequence: s.sequence }),
      await getRequestMeta(),
    );
    refresh(assessmentId);
    return { success: "CREATED", details: [String(count)] };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function createSessionAction(assessmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), VALIDATION_ROLES.schedule);
    const parsed = sessionSchema.safeParse(sessionFields(formData));
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await createSession(access, parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "CREATED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updateSessionAction(assessmentId: string, sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), VALIDATION_ROLES.schedule);
    const parsed = sessionUpdateSchema.safeParse(sessionFields(formData));
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await updateSession(access, idSchema.parse(sessionId), parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function saveAssessorFormAction(assessmentId: string, sessionId: string, input: unknown): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), VALIDATION_ROLES.rate);
    const parsed = assessorFormSchema.safeParse(input);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await saveAssessorForm(access, idSchema.parse(sessionId), parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function addParticipantAction(assessmentId: string, sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), VALIDATION_ROLES.rate);
    const parsed = participantSchema.safeParse({ fullName: formData.get("fullName"), position: formData.get("position") });
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await addParticipant(access, idSchema.parse(sessionId), parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function removeParticipantAction(assessmentId: string, participantId: string): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), VALIDATION_ROLES.rate);
    await removeParticipant(access, idSchema.parse(participantId), await getRequestMeta());
    refresh(assessmentId);
    return { success: "REMOVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updateGuideAction(assessmentId: string, input: unknown): Promise<ActionState> {
  try {
    const access = await requireRole(idSchema.parse(assessmentId), VALIDATION_ROLES.schedule);
    const parsed = guideSchema.safeParse(input);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await updateGuideTemplate(access, parsed.data, await getRequestMeta());
    refresh(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}
