import type { ActionState } from "@/components/forms/action-state";
import { AccessError } from "@/lib/auth/access";
import { AssessmentRuleError } from "./service";

/** Mengubah galat akses dan aturan asesmen menjadi kode pesan formulir. Galat lain diteruskan. */
export function actionErrorState(error: unknown): ActionState {
  if (error instanceof AccessError) return { error: error.status === 401 ? "EXPIRED" : "FORBIDDEN" };
  if (error instanceof AssessmentRuleError) {
    const unmet = (error.details as { unmet?: string[] } | undefined)?.unmet;
    return { error: error.code, ...(unmet ? { details: unmet } : {}) };
  }
  throw error;
}

/** Untuk Route Handler: kode status HTTP dari galat aturan asesmen (409 bila sudah dikunci). */
export function assessmentErrorResponse(error: unknown): Response | null {
  if (error instanceof AssessmentRuleError) {
    return Response.json({ error: error.code, ...(error.details ? { details: error.details } : {}) }, { status: error.status });
  }
  return null;
}
