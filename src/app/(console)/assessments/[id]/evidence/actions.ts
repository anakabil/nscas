"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { deleteEvidence, finalizeEvidenceUpload, linksSchema, requestEvidenceUpload, updateEvidenceLinks, uploadRequestSchema, type EvidenceLinkInput, type UploadGrant } from "@/lib/evidence/service";
import { getRequestMeta } from "@/lib/request-meta";

// Server Action bukti (docs/01 M5). Diubah CLIENT_ADMIN dan UNIT_COORDINATOR untuk unitnya (docs/04 bagian 2).

const idSchema = z.string().min(1).max(64);

async function actor(assessmentId: string) {
  return requireRole(idSchema.parse(assessmentId), rolesFor("evidenceAndObservations", "write"));
}

function done(assessmentId: string) {
  revalidatePath(`/assessments/${assessmentId}/evidence`);
}

export async function requestEvidenceUploadAction(assessmentId: string, input: unknown): Promise<{ grant?: UploadGrant; error?: string }> {
  try {
    const access = await actor(assessmentId);
    const parsed = uploadRequestSchema.safeParse(input);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    return { grant: await requestEvidenceUpload(access, parsed.data) };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function finalizeEvidenceUploadAction(assessmentId: string, ticket: string, links: unknown): Promise<{ version?: number; error?: string }> {
  try {
    const access = await actor(assessmentId);
    const parsedLinks = links === null ? { success: true as const, data: null } : linksSchema.safeParse(links);
    if (!parsedLinks.success || typeof ticket !== "string" || ticket.length > 4000) return { error: "INVALID_INPUT" };
    const result = await finalizeEvidenceUpload(access, ticket, parsedLinks.data as EvidenceLinkInput | null, await getRequestMeta());
    done(assessmentId);
    return { version: result.version };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function updateEvidenceLinksAction(assessmentId: string, evidenceId: string, links: unknown): Promise<{ success?: string; error?: string }> {
  try {
    const access = await actor(assessmentId);
    const parsed = linksSchema.safeParse(links);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await updateEvidenceLinks(access, idSchema.parse(evidenceId), parsed.data, await getRequestMeta());
    done(assessmentId);
    return { success: "SAVED" };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function deleteEvidenceAction(assessmentId: string, evidenceId: string): Promise<{ success?: string; error?: string }> {
  try {
    const access = await actor(assessmentId);
    await deleteEvidence(access, idSchema.parse(evidenceId), await getRequestMeta());
    done(assessmentId);
    return { success: "DELETED" };
  } catch (error) {
    return actionErrorState(error);
  }
}
