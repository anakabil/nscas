import "server-only";
import { cookies } from "next/headers";
import { openToken, sealToken } from "@/lib/privacy/crypto";

// Tantangan masuk dua langkah: bukti tersegel bahwa kata sandi sudah benar, berumur 5 menit,
// disimpan di cookie httpOnly yang hanya dikirim ke /login.

const COOKIE = "nscas-login-challenge";
const TTL_MS = 5 * 60 * 1000;

export interface LoginChallenge {
  uid: string;
  /** Waktu kata sandi diverifikasi; tantangan ditolak bila sudah ada login yang berhasil sesudahnya. */
  iat: number;
}

export async function setLoginChallenge(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sealToken({ uid: userId, iat: Date.now() }, "login-challenge", TTL_MS), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/login",
    maxAge: TTL_MS / 1000,
  });
}

export async function readLoginChallenge(): Promise<LoginChallenge | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const payload = openToken<{ uid: unknown; iat: unknown }>(value, "login-challenge");
  if (!payload || typeof payload.uid !== "string" || typeof payload.iat !== "number") return null;
  return { uid: payload.uid, iat: payload.iat };
}

export async function clearLoginChallenge(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/login" });
}
