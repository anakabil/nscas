"use server";

// Server Action alur masuk. Sengaja tidak memakai guard karena pengguna belum masuk; seluruh
// pemeriksaan (pembatas laju, penguncian, kata sandi, TOTP, jejak audit) ada di src/lib/auth/login.ts.
// guard-exempt: login

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import type { ActionState } from "@/components/forms/action-state";
import { completeLogin, verifyPasswordStep, verifySecondFactorStep } from "@/lib/auth/login";
import { getDb } from "@/lib/db";
import { loginRateLimiter } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { clearLoginChallenge, readLoginChallenge, setLoginChallenge } from "./challenge";

const AFTER_LOGIN = "/assessments";

async function exchangeGrant(grant: string): Promise<ActionState> {
  try {
    await signIn("credentials", { grant, redirectTo: AFTER_LOGIN });
  } catch (error) {
    // signIn melempar NEXT_REDIRECT saat berhasil; hanya galat Auth.js yang ditangani di sini.
    if (error instanceof AuthError) return { error: "EXPIRED" };
    throw error;
  }
  return {};
}

const passwordStepSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordStepSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "INVALID_INPUT" };

  const meta = await getRequestMeta();
  const result = await verifyPasswordStep(parsed.data.email, parsed.data.password, meta);
  if (!result.ok) return { error: result.error };

  if (result.secondFactorRequired) {
    await setLoginChallenge(result.userId);
    redirect("/login/verify");
  }

  const grant = await completeLogin(result.userId, { totpVerified: false, meta });
  return exchangeGrant(grant);
}

const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

export async function verifyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "INVALID_INPUT" };

  const challenge = await readLoginChallenge();
  if (!challenge) return { error: "EXPIRED" };

  // Tantangan hanya berlaku sekali: ditolak bila sudah ada login yang berhasil setelah kata sandi diverifikasi.
  const user = await getDb().user.findUnique({ where: { id: challenge.uid }, select: { lastLoginAt: true } });
  if (!user || (user.lastLoginAt && user.lastLoginAt.getTime() >= challenge.iat)) {
    await clearLoginChallenge();
    return { error: "EXPIRED" };
  }
  if (!loginRateLimiter.consume(`verify:${challenge.uid}`).allowed) return { error: "RATE_LIMITED" };

  const meta = await getRequestMeta();
  const result = await verifySecondFactorStep(challenge.uid, parsed.data.code, meta);
  if (!result.ok) {
    if (result.error === "LOCKED" || result.error === "EXPIRED") await clearLoginChallenge();
    return { error: result.error };
  }

  const grant = await completeLogin(challenge.uid, { totpVerified: true, meta });
  await clearLoginChallenge();
  return exchangeGrant(grant);
}
