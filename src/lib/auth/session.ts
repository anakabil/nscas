import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { buildPrincipal, type MembershipInfo, type Principal } from "./access";
import { IDLE_TIMEOUT_ROLES, TOTP_REQUIRED_ROLES, isValidMembership } from "./roles";
import { evaluateSession } from "./session-policy";

export interface SessionMembership extends MembershipInfo {
  organizationName: string;
}

export interface SessionContext {
  sessionId: string;
  user: {
    id: string;
    email: string;
    name: string;
    totpEnabled: boolean;
    mustChangePassword: boolean;
  };
  principal: Principal;
  memberships: SessionMembership[];
  /** Peran pengguna mewajibkan TOTP (docs/04 bagian 3). */
  totpRequired: boolean;
  /** TOTP wajib tetapi belum diaktifkan atau belum diverifikasi pada sesi ini. */
  totpPending: boolean;
}

/**
 * Konteks sesi untuk satu permintaan. Mengembalikan null bila tidak masuk, atau bila sesi dicabut,
 * kedaluwarsa (8 jam), tidak aktif melebihi 30 menit untuk peran Nusa Safety, atau pengguna dinonaktifkan.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth();
  const sid = (session as { sid?: unknown } | null)?.sid;
  if (typeof sid !== "string") return null;

  const db = getDb();
  const row = await db.userSession.findUnique({
    where: { id: sid },
    include: {
      user: {
        include: {
          memberships: { include: { organization: { select: { id: true, name: true, isOperator: true } } } },
        },
      },
    },
  });
  if (!row) return null;

  const memberships: SessionMembership[] = row.user.memberships.map((m) => ({
    organizationId: m.organizationId,
    organizationName: m.organization.name,
    organizationIsOperator: m.organization.isOperator,
    role: m.role,
    unitScope: m.unitScope,
  }));
  const principal = buildPrincipal(row.userId, memberships);
  const roles = principal.memberships.map((m) => m.role);

  const now = new Date();
  const idleTimeoutApplies = roles.some((r) => (IDLE_TIMEOUT_ROLES as readonly string[]).includes(r));
  const evaluation = evaluateSession(row, row.user, idleTimeoutApplies, now);
  if (!evaluation.valid) {
    if (!row.revokedAt) {
      await db.userSession.update({ where: { id: row.id }, data: { revokedAt: now, revokedReason: evaluation.reason } });
    }
    return null;
  }
  if (evaluation.shouldTouch) {
    await db.userSession.update({ where: { id: row.id }, data: { lastActivityAt: now } });
  }

  const totpRequired = roles.some((r) => (TOTP_REQUIRED_ROLES as readonly string[]).includes(r));
  return {
    sessionId: row.id,
    user: {
      id: row.user.id,
      email: row.user.email,
      name: row.user.name,
      totpEnabled: row.user.totpEnabled,
      mustChangePassword: row.user.mustChangePassword,
    },
    principal,
    memberships: memberships.filter((m) => isValidMembership(m.role, m.organizationIsOperator)),
    totpRequired,
    totpPending: totpRequired && !(row.user.totpEnabled && row.totpVerified),
  };
});
