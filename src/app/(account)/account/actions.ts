"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/auth";
import type { ActionState } from "@/components/forms/action-state";
import {
  changeOwnPassword,
  confirmTotpEnrollment,
  logoutSession,
  regenerateBackupCodes,
} from "@/lib/auth/account";
import { getSessionContext } from "@/lib/auth/session";
import { AccessError, requireUser } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";

// Pengaturan akun milik pengguna sendiri. Semua aksi memakai requireUser dengan allowSetupPending,
// karena aksi inilah yang dipakai untuk menyelesaikan penyiapan akun.

async function currentUser() {
  try {
    return await requireUser({ allowSetupPending: true });
  } catch (error) {
    if (error instanceof AccessError) return null;
    throw error;
  }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128),
});

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await currentUser();
  if (!session) return { error: "EXPIRED" };
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "INVALID_INPUT" };
  if (parsed.data.newPassword !== parsed.data.confirmPassword) return { error: "MISMATCH" };

  const result = await changeOwnPassword(session, parsed.data, await getRequestMeta());
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return { success: "PASSWORD_CHANGED" };
}

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

export async function confirmTotpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await currentUser();
  if (!session) return { error: "EXPIRED" };
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "INVALID_INPUT" };

  const result = await confirmTotpEnrollment(session, parsed.data.code, await getRequestMeta());
  if (!result.ok) return { error: result.error };
  return { success: "TOTP_ENABLED", secrets: result.data.backupCodes };
}

export async function regenerateBackupCodesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await currentUser();
  if (!session) return { error: "EXPIRED" };
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "INVALID_INPUT" };

  const result = await regenerateBackupCodes(session, parsed.data.code, await getRequestMeta());
  if (!result.ok) return { error: result.error };
  return { success: "BACKUP_CODES_REGENERATED", secrets: result.data.backupCodes };
}

export async function logoutAction(): Promise<void> {
  // Keluar tetap berjalan walau sesi sudah tidak sah, agar cookie selalu terhapus.
  const session = await getSessionContext();
  if (session) await logoutSession(session, await getRequestMeta());
  await signOut({ redirectTo: "/login" });
}
