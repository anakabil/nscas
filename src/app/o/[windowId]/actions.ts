"use server";

import { z } from "zod";
import { actionErrorState } from "@/lib/assessments/action-errors";
import { requireRole, requireUser } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { captureRequestSchema, finalizeCapture, loadWindow, requestCaptureUpload } from "@/lib/observations/service";
import { getRequestMeta } from "@/lib/request-meta";

// Server Action observasi digital (docs/01 M6) untuk koordinator dan administrator klien, dibatasi ke unit jendela.

const idSchema = z.string().min(1).max(64);

async function actor(windowId: string) {
  await requireUser();
  const window = await loadWindow(idSchema.parse(windowId));
  if (!window) return null;
  return requireRole(window.assessmentId, rolesFor("evidenceAndObservations", "write"), { unitId: window.unitId });
}

export async function requestCaptureAction(
  windowId: string,
  input: unknown,
): Promise<{ grant?: { url: string; headers: Record<string, string>; ticket: string }; error?: string }> {
  try {
    const access = await actor(windowId);
    if (!access) return { error: "NOT_FOUND" };
    const parsed = captureRequestSchema.safeParse(input);
    if (!parsed.success) return { error: "INVALID_INPUT" };
    const grant = await requestCaptureUpload(access, windowId, parsed.data);
    return { grant: { url: grant.url, headers: grant.headers, ticket: grant.ticket } };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function finalizeCaptureAction(
  windowId: string,
  ticket: string,
  note: string,
): Promise<{ result?: { outsideRadius: boolean; serverCapturedAt: string; distanceMeters: number | null }; error?: string }> {
  try {
    const access = await actor(windowId);
    if (!access) return { error: "NOT_FOUND" };
    const input = z.object({ ticket: z.string().min(1).max(4000), note: z.string().max(1000) }).safeParse({ ticket, note });
    if (!input.success) return { error: "INVALID_INPUT" };
    const result = await finalizeCapture(access, input.data.ticket, input.data.note, await getRequestMeta());
    return {
      result: {
        outsideRadius: result.outsideRadius,
        serverCapturedAt: result.serverCapturedAt.toISOString(),
        distanceMeters: result.distanceFromSiteMeters === null ? null : Math.round(result.distanceFromSiteMeters),
      },
    };
  } catch (error) {
    return actionErrorState(error);
  }
}
