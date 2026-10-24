import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestMeta } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { openToken, sealToken } from "@/lib/privacy/crypto";
import { SESSION_ABSOLUTE_MS, SESSION_GRANT_TTL_MS } from "./session-policy";

// Penyimpanan sesi di sisi server. Terpisah dari session.ts agar tidak bergantung pada Auth.js,
// sehingga layanan masuk dapat diuji langsung terhadap basis data.

/** Membuat sesi di sisi server. Dipanggil di dalam transaksi alur masuk. */
export async function createUserSession(
  tx: Prisma.TransactionClient,
  input: { userId: string; totpVerified: boolean; meta: RequestMeta; now?: Date },
): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  return tx.userSession.create({
    data: {
      userId: input.userId,
      totpVerified: input.totpVerified,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
      ipHash: input.meta.ipHash,
      userAgent: input.meta.userAgent,
    },
    select: { id: true },
  });
}

/** Izin sesi sekali pakai yang ditukar menjadi cookie Auth.js melalui signIn("credentials"). */
export function issueSessionGrant(sessionId: string): string {
  return sealToken({ sid: sessionId }, "session-grant", SESSION_GRANT_TTL_MS);
}

/** Dipanggil dari authorize Auth.js. Mengikat sesi sekali saja, dalam batas waktu izin. */
export async function bindSessionGrant(grant: string): Promise<{ id: string; sid: string } | null> {
  const payload = openToken<{ sid: string }>(grant, "session-grant");
  if (!payload || typeof payload.sid !== "string") return null;
  const now = new Date();
  const db = getDb();
  const bound = await db.userSession.updateMany({
    where: {
      id: payload.sid,
      boundAt: null,
      revokedAt: null,
      createdAt: { gte: new Date(now.getTime() - SESSION_GRANT_TTL_MS) },
    },
    data: { boundAt: now },
  });
  if (bound.count !== 1) return null;
  const session = await db.userSession.findUniqueOrThrow({ where: { id: payload.sid }, select: { userId: true } });
  return { id: session.userId, sid: payload.sid };
}

export async function revokeUserSessions(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: string,
  options: { exceptSessionId?: string } = {},
): Promise<number> {
  const result = await tx.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

