"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms/action-state";
import { AccessError, requireOrganizationRole, requireSuperAdmin } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getRequestMeta } from "@/lib/request-meta";
import {
  createClientOrganization,
  createOrAddUser,
  createOrganizationSchema,
  createUserSchema,
  resetUserPassword,
  resetUserTotp,
  revokeMembership,
  setUserActive,
  unlockUser,
  type OrganizationActor,
} from "@/lib/users/admin";

const idSchema = z.string().min(1).max(64);

function accessErrorState(error: unknown): ActionState {
  if (error instanceof AccessError) return { error: error.status === 401 ? "EXPIRED" : "FORBIDDEN" };
  throw error;
}

async function organizationActor(organizationId: string): Promise<OrganizationActor> {
  const access = await requireOrganizationRole(idSchema.parse(organizationId), rolesFor("organizationsAndUsers", "write"));
  return { session: access.session, organizationId: access.organizationId, isOperator: access.isOperator, roles: access.roles };
}

export async function createOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const session = await requireSuperAdmin();
    const parsed = createOrganizationSchema.safeParse({
      name: formData.get("name"),
      legalName: formData.get("legalName"),
      sector: formData.get("sector") ?? undefined,
    });
    if (!parsed.success) return { error: "INVALID_INPUT" };
    await createClientOrganization(session, parsed.data, await getRequestMeta());
    revalidatePath("/orgs");
    return { success: "CREATED" };
  } catch (error) {
    return accessErrorState(error);
  }
}

export async function addUserAction(organizationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await organizationActor(organizationId);
    const parsed = createUserSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
      role: formData.get("role"),
      unitScope: formData.getAll("unitScope"),
    });
    if (!parsed.success) return { error: "INVALID_INPUT" };
    const result = await createOrAddUser(actor, parsed.data, await getRequestMeta());
    if (!result.ok) return { error: result.error };
    revalidatePath(`/orgs/${actor.organizationId}`);
    return result.data.temporaryPassword
      ? { success: "ADDED", secrets: [result.data.temporaryPassword] }
      : { success: "ADDED_EXISTING" };
  } catch (error) {
    return accessErrorState(error);
  }
}

const manageSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.enum(["activate", "deactivate", "resetTotp", "resetPassword", "unlock"]) }),
  z.object({ intent: z.literal("revokeRole"), membershipId: idSchema }),
]);

export async function manageUserAction(
  organizationId: string,
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await organizationActor(organizationId);
    const targetId = idSchema.parse(userId);
    const parsed = manageSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: "INVALID_INPUT" };
    const meta = await getRequestMeta();

    let state: ActionState;
    switch (parsed.data.intent) {
      case "activate":
      case "deactivate": {
        const r = await setUserActive(actor, targetId, parsed.data.intent === "activate", meta);
        state = r.ok ? { success: "DONE" } : { error: r.error };
        break;
      }
      case "resetTotp": {
        const r = await resetUserTotp(actor, targetId, meta);
        state = r.ok ? { success: "DONE" } : { error: r.error };
        break;
      }
      case "unlock": {
        const r = await unlockUser(actor, targetId, meta);
        state = r.ok ? { success: "DONE" } : { error: r.error };
        break;
      }
      case "resetPassword": {
        const r = await resetUserPassword(actor, targetId, meta);
        state = r.ok ? { success: "DONE", secrets: [r.data.temporaryPassword] } : { error: r.error };
        break;
      }
      case "revokeRole": {
        const r = await revokeMembership(actor, targetId, parsed.data.membershipId, meta);
        state = r.ok ? { success: "DONE" } : { error: r.error };
        break;
      }
    }
    revalidatePath(`/orgs/${actor.organizationId}/users/${targetId}`);
    return state;
  } catch (error) {
    return accessErrorState(error);
  }
}
