import "server-only";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { logAudit, type RequestMeta } from "@/lib/audit";
import { AccessError } from "@/lib/auth/access";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/passwords";
import { grantableRoles } from "@/lib/auth/roles";
import type { SessionContext } from "@/lib/auth/session";
import { revokeUserSessions } from "@/lib/auth/session-store";
import { getDb } from "@/lib/db";

// Manajemen pengguna oleh SUPER_ADMIN (seluruh organisasi) dan CLIENT_ADMIN (pengguna klien di
// organisasinya). Pemanggil wajib sudah lolos requireOrganizationRole untuk organisasi tujuan.

export interface OrganizationActor {
  session: SessionContext;
  organizationId: string;
  isOperator: boolean;
  roles: Role[];
}

function actorRole(actor: OrganizationActor): Role | null {
  return actor.session.principal.isSuperAdmin ? "SUPER_ADMIN" : (actor.roles[0] ?? null);
}

function allowedRolesFor(actor: OrganizationActor): Role[] {
  return grantableRoles(
    { isSuperAdmin: actor.session.principal.isSuperAdmin, isClientAdminOfTarget: actor.roles.includes("CLIENT_ADMIN") },
    actor.isOperator,
  );
}

export const createUserSchema = z.object({
  email: z.email().max(254).transform((e) => e.trim().toLowerCase()),
  name: z.string().trim().min(1).max(200),
  role: z.enum(["SUPER_ADMIN", "LEAD_ASSESSOR", "ASSESSOR", "CLIENT_ADMIN", "UNIT_COORDINATOR", "EXECUTIVE_VIEWER"]),
  unitScope: z.array(z.string().min(1).max(64)).max(500).default([]),
});

export type UserAdminError =
  | "ROLE_NOT_ALLOWED"
  | "EMAIL_IN_OTHER_ORGANIZATION"
  | "ALREADY_MEMBER"
  | "UNIT_OUT_OF_SCOPE"
  | "UNIT_SCOPE_REQUIRED"
  | "CANNOT_MANAGE_SELF"
  | "LAST_ROLE";

export type UserAdminResult<T = undefined> = { ok: true; data: T } | { ok: false; error: UserAdminError };

async function assertUnitsInOrganization(organizationId: string, unitIds: string[]): Promise<boolean> {
  if (unitIds.length === 0) return true;
  const count = await getDb().unit.count({
    where: { id: { in: unitIds }, assessment: { organizationId } },
  });
  return count === new Set(unitIds).size;
}

/**
 * Membuat pengguna baru dengan kata sandi sementara (wajib diganti saat masuk pertama), atau menambahkan
 * peran ke pengguna yang sudah ada. CLIENT_ADMIN tidak dapat menambahkan akun yang terdaftar di organisasi lain.
 */
export async function createOrAddUser(
  actor: OrganizationActor,
  input: z.input<typeof createUserSchema>,
  meta: RequestMeta,
): Promise<UserAdminResult<{ userId: string; temporaryPassword: string | null }>> {
  const data = createUserSchema.parse(input);
  if (!allowedRolesFor(actor).includes(data.role)) return { ok: false, error: "ROLE_NOT_ALLOWED" };

  const unitScope = data.role === "UNIT_COORDINATOR" ? [...new Set(data.unitScope)] : [];
  if (data.role === "UNIT_COORDINATOR" && unitScope.length === 0) return { ok: false, error: "UNIT_SCOPE_REQUIRED" };
  if (!(await assertUnitsInOrganization(actor.organizationId, unitScope))) return { ok: false, error: "UNIT_OUT_OF_SCOPE" };

  const db = getDb();
  const existing = await db.user.findUnique({
    where: { email: data.email },
    select: { id: true, memberships: { select: { organizationId: true, role: true } } },
  });

  if (existing) {
    const inThisOrg = existing.memberships.some((m) => m.organizationId === actor.organizationId);
    if (!actor.session.principal.isSuperAdmin && !inThisOrg) return { ok: false, error: "EMAIL_IN_OTHER_ORGANIZATION" };
    if (existing.memberships.some((m) => m.organizationId === actor.organizationId && m.role === data.role)) {
      return { ok: false, error: "ALREADY_MEMBER" };
    }
  }

  const temporaryPassword = existing ? null : generateTemporaryPassword();
  const passwordHash = temporaryPassword ? await hashPassword(temporaryPassword) : null;

  const userId = await db.$transaction(async (tx) => {
    let id = existing?.id;
    if (!id) {
      const created = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash: passwordHash as string, mustChangePassword: true },
        select: { id: true },
      });
      id = created.id;
      await logAudit(tx, {
        action: "user.create",
        entityType: "User",
        entityId: id,
        actor: { id: actor.session.user.id, role: actorRole(actor) },
        organizationId: actor.organizationId,
        after: { email: data.email, name: data.name },
        meta,
      });
    }
    const membership = await tx.membership.create({
      data: { userId: id, organizationId: actor.organizationId, role: data.role, unitScope },
      select: { id: true },
    });
    await logAudit(tx, {
      action: "membership.role_grant",
      entityType: "Membership",
      entityId: membership.id,
      actor: { id: actor.session.user.id, role: actorRole(actor) },
      organizationId: actor.organizationId,
      after: { userId: id, role: data.role, unitScope },
      meta,
    });
    return id;
  });

  return { ok: true, data: { userId, temporaryPassword } };
}

/**
 * Memastikan pelaku boleh mengelola akun tertentu di organisasi ini. CLIENT_ADMIN hanya untuk akun yang
 * seluruh keanggotaannya berada di organisasinya; tindakan terhadap akun sendiri ditolak.
 */
async function loadManagedUser(actor: OrganizationActor, userId: string) {
  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      isActive: true,
      lockedUntil: true,
      totpEnabled: true,
      memberships: { select: { id: true, organizationId: true, role: true } },
    },
  });
  if (!user || !user.memberships.some((m) => m.organizationId === actor.organizationId)) {
    throw new AccessError(404, "NOT_FOUND");
  }
  if (!actor.session.principal.isSuperAdmin && user.memberships.some((m) => m.organizationId !== actor.organizationId)) {
    throw new AccessError(403, "FORBIDDEN");
  }
  return user;
}

export async function setUserActive(
  actor: OrganizationActor,
  userId: string,
  active: boolean,
  meta: RequestMeta,
): Promise<UserAdminResult> {
  if (userId === actor.session.user.id) return { ok: false, error: "CANNOT_MANAGE_SELF" };
  const user = await loadManagedUser(actor, userId);
  await getDb().$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { isActive: active } });
    const revoked = active ? 0 : await revokeUserSessions(tx, user.id, "USER_DEACTIVATED");
    await logAudit(tx, {
      action: active ? "user.activate" : "user.deactivate",
      entityType: "User",
      entityId: user.id,
      actor: { id: actor.session.user.id, role: actorRole(actor) },
      organizationId: actor.organizationId,
      before: { isActive: user.isActive },
      after: { isActive: active, sessionsRevoked: revoked },
      meta,
    });
  });
  return { ok: true, data: undefined };
}

/** Atur ulang TOTP: rahasia dan kode cadangan dihapus, sesi dicabut, aktivasi ulang wajib saat masuk berikutnya. */
export async function resetUserTotp(actor: OrganizationActor, userId: string, meta: RequestMeta): Promise<UserAdminResult> {
  if (userId === actor.session.user.id) return { ok: false, error: "CANNOT_MANAGE_SELF" };
  const user = await loadManagedUser(actor, userId);
  await getDb().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { totpEnabled: false, totpSecretEnc: null, totpEnabledAt: null, totpLastUsedStep: null },
    });
    await tx.backupCode.deleteMany({ where: { userId: user.id } });
    const revoked = await revokeUserSessions(tx, user.id, "TOTP_RESET");
    await logAudit(tx, {
      action: "auth.totp_reset",
      entityType: "User",
      entityId: user.id,
      actor: { id: actor.session.user.id, role: actorRole(actor) },
      organizationId: actor.organizationId,
      before: { totpEnabled: user.totpEnabled },
      after: { totpEnabled: false, sessionsRevoked: revoked },
      meta,
    });
  });
  return { ok: true, data: undefined };
}

export async function unlockUser(actor: OrganizationActor, userId: string, meta: RequestMeta): Promise<UserAdminResult> {
  const user = await loadManagedUser(actor, userId);
  await getDb().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { lockedUntil: null, failedLoginCount: 0, failedLoginWindowStart: null },
    });
    await logAudit(tx, {
      action: "auth.account_unlocked",
      entityType: "User",
      entityId: user.id,
      actor: { id: actor.session.user.id, role: actorRole(actor) },
      organizationId: actor.organizationId,
      before: { lockedUntil: user.lockedUntil?.toISOString() ?? null },
      meta,
    });
  });
  return { ok: true, data: undefined };
}

/** Kata sandi sementara baru; wajib diganti saat masuk berikutnya. Sesi aktif dicabut. */
export async function resetUserPassword(
  actor: OrganizationActor,
  userId: string,
  meta: RequestMeta,
): Promise<UserAdminResult<{ temporaryPassword: string }>> {
  if (userId === actor.session.user.id) return { ok: false, error: "CANNOT_MANAGE_SELF" };
  const user = await loadManagedUser(actor, userId);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await getDb().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date() },
    });
    const revoked = await revokeUserSessions(tx, user.id, "PASSWORD_RESET");
    await logAudit(tx, {
      action: "auth.password_reset",
      entityType: "User",
      entityId: user.id,
      actor: { id: actor.session.user.id, role: actorRole(actor) },
      organizationId: actor.organizationId,
      after: { sessionsRevoked: revoked },
      meta,
    });
  });
  return { ok: true, data: { temporaryPassword } };
}

/** Mencabut satu peran di organisasi ini. Peran terakhir tidak dicabut; nonaktifkan akun sebagai gantinya. */
export async function revokeMembership(
  actor: OrganizationActor,
  userId: string,
  membershipId: string,
  meta: RequestMeta,
): Promise<UserAdminResult> {
  if (userId === actor.session.user.id) return { ok: false, error: "CANNOT_MANAGE_SELF" };
  const user = await loadManagedUser(actor, userId);
  const membership = user.memberships.find((m) => m.id === membershipId && m.organizationId === actor.organizationId);
  if (!membership) throw new AccessError(404, "NOT_FOUND");
  if (!allowedRolesFor(actor).includes(membership.role)) return { ok: false, error: "ROLE_NOT_ALLOWED" };
  if (user.memberships.length === 1) return { ok: false, error: "LAST_ROLE" };

  await getDb().$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: membership.id } });
    await revokeUserSessions(tx, user.id, "ROLE_REVOKED");
    await logAudit(tx, {
      action: "membership.role_revoke",
      entityType: "Membership",
      entityId: membership.id,
      actor: { id: actor.session.user.id, role: actorRole(actor) },
      organizationId: actor.organizationId,
      before: { userId: user.id, role: membership.role },
      meta,
    });
  });
  return { ok: true, data: undefined };
}

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  legalName: z.string().trim().min(2).max(200),
  sector: z.string().trim().max(200).optional().transform((s) => s || null),
});

/** Membuat organisasi klien. Hanya SUPER_ADMIN; pemanggil wajib sudah lolos requireSuperAdmin. */
export async function createClientOrganization(
  session: SessionContext,
  data: z.output<typeof createOrganizationSchema>,
  meta: RequestMeta,
): Promise<{ id: string }> {
  return getDb().$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { ...data, isOperator: false }, select: { id: true } });
    await logAudit(tx, {
      action: "organization.create",
      entityType: "Organization",
      entityId: org.id,
      actor: { id: session.user.id, role: "SUPER_ADMIN" },
      organizationId: org.id,
      after: data,
      meta,
    });
    return org;
  });
}
