// Inti otorisasi: siapa boleh mengakses asesmen dan organisasi mana, dengan peran apa.
// Dipakai oleh guard.ts; fungsi resolve* murni agar setiap kombinasi dapat diuji tanpa basis data.

import type { AssignmentRole, Role } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { isValidMembership } from "./roles";

export interface MembershipInfo {
  organizationId: string;
  organizationIsOperator: boolean;
  role: Role;
  unitScope: string[];
}

/** Pengguna yang sudah lolos pemeriksaan sesi. */
export interface Principal {
  userId: string;
  isSuperAdmin: boolean;
  /** Hanya keanggotaan yang sah (peran operator di organisasi operator, peran klien di organisasi klien). */
  memberships: MembershipInfo[];
}

export class AccessError extends Error {
  constructor(
    readonly status: 401 | 403 | 404,
    readonly code: "UNAUTHENTICATED" | "SETUP_REQUIRED" | "FORBIDDEN" | "NOT_FOUND",
  ) {
    super(code);
    this.name = "AccessError";
  }
}

export function buildPrincipal(userId: string, memberships: MembershipInfo[]): Principal {
  const valid = memberships.filter((m) => isValidMembership(m.role, m.organizationIsOperator));
  return {
    userId,
    isSuperAdmin: valid.some((m) => m.role === "SUPER_ADMIN"),
    memberships: valid,
  };
}

function operatorRoles(principal: Principal): Role[] {
  return principal.memberships.filter((m) => m.organizationIsOperator).map((m) => m.role);
}

export interface AssessmentAccess {
  userId: string;
  assessmentId: string;
  organizationId: string;
  /** Peran pengguna yang cocok dengan allowedRoles. */
  roles: Role[];
  /** null berarti semua unit; larik berarti hanya unit tersebut (UNIT_COORDINATOR). */
  unitScope: string[] | null;
}

export type AccessDecision =
  | { ok: true; roles: Role[]; unitScope: string[] | null }
  | { ok: false; status: 403 | 404 };

/**
 * Peran efektif pengguna pada satu asesmen:
 * - SUPER_ADMIN: global, dari keanggotaan di organisasi operator.
 * - LEAD_ASSESSOR dan ASSESSOR: dari penugasan asesmen, dan hanya bagi staf Nusa Safety
 *   (memiliki keanggotaan LEAD_ASSESSOR atau ASSESSOR di organisasi operator).
 * - Peran klien: dari keanggotaan di organisasi pemilik asesmen.
 * Pengguna tanpa hubungan apa pun dengan asesmen mendapat 404 agar keberadaan asesmen tidak terungkap.
 * Bila satu-satunya peran yang cocok adalah UNIT_COORDINATOR, akses dibatasi ke unit dalam unitScope.
 */
export function resolveAssessmentAccess(input: {
  principal: Principal;
  assessmentOrganizationId: string;
  assignmentRole: AssignmentRole | null;
  allowedRoles: readonly Role[];
  unitId?: string | null;
}): AccessDecision {
  const { principal, assessmentOrganizationId, assignmentRole, allowedRoles, unitId } = input;
  const effective = new Set<Role>();
  const coordinatorScope = new Set<string>();

  if (principal.isSuperAdmin) effective.add("SUPER_ADMIN");

  const staff = operatorRoles(principal).some((r) => r === "LEAD_ASSESSOR" || r === "ASSESSOR");
  if (assignmentRole && staff) effective.add(assignmentRole);

  for (const m of principal.memberships) {
    if (m.organizationIsOperator || m.organizationId !== assessmentOrganizationId) continue;
    effective.add(m.role);
    if (m.role === "UNIT_COORDINATOR") m.unitScope.forEach((u) => coordinatorScope.add(u));
  }

  if (effective.size === 0) return { ok: false, status: 404 };

  const matched = allowedRoles.filter((r) => effective.has(r));
  if (matched.length === 0) return { ok: false, status: 403 };

  const unitRestricted = matched.every((r) => r === "UNIT_COORDINATOR");
  if (!unitRestricted) return { ok: true, roles: matched, unitScope: null };

  const scope = [...coordinatorScope];
  if (unitId && !coordinatorScope.has(unitId)) return { ok: false, status: 403 };
  return { ok: true, roles: matched, unitScope: scope };
}

export type OrganizationDecision = { ok: true; roles: Role[] } | { ok: false; status: 403 | 404 };

/**
 * Peran efektif pada tingkat organisasi (manajemen pengguna). Peran operator berlaku global
 * bagi staf Nusa Safety; peran klien hanya di organisasinya.
 */
export function resolveOrganizationAccess(
  principal: Principal,
  organization: { id: string; isOperator: boolean },
  allowedRoles: readonly Role[],
): OrganizationDecision {
  const effective = new Set<Role>(operatorRoles(principal));
  if (!organization.isOperator) {
    for (const m of principal.memberships) {
      if (!m.organizationIsOperator && m.organizationId === organization.id) effective.add(m.role);
    }
  }
  if (effective.size === 0) return { ok: false, status: 404 };
  const matched = allowedRoles.filter((r) => effective.has(r));
  return matched.length > 0 ? { ok: true, roles: matched } : { ok: false, status: 403 };
}

type Db = Pick<PrismaClient, "assessment" | "assessmentAssignment" | "unit" | "organization">;

export async function authorizeAssessmentAccess(
  db: Db,
  principal: Principal,
  assessmentId: string,
  allowedRoles: readonly Role[],
  options: { unitId?: string | null } = {},
): Promise<AssessmentAccess> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, organizationId: true },
  });
  if (!assessment) throw new AccessError(404, "NOT_FOUND");

  if (options.unitId) {
    const unit = await db.unit.findUnique({ where: { id: options.unitId }, select: { assessmentId: true } });
    if (!unit || unit.assessmentId !== assessment.id) throw new AccessError(404, "NOT_FOUND");
  }

  const assignment = await db.assessmentAssignment.findUnique({
    where: { assessmentId_userId: { assessmentId, userId: principal.userId } },
    select: { role: true },
  });

  const decision = resolveAssessmentAccess({
    principal,
    assessmentOrganizationId: assessment.organizationId,
    assignmentRole: assignment?.role ?? null,
    allowedRoles,
    unitId: options.unitId,
  });
  if (!decision.ok) throw new AccessError(decision.status, decision.status === 404 ? "NOT_FOUND" : "FORBIDDEN");

  return {
    userId: principal.userId,
    assessmentId: assessment.id,
    organizationId: assessment.organizationId,
    roles: decision.roles,
    unitScope: decision.unitScope,
  };
}

export async function authorizeOrganizationAccess(
  db: Db,
  principal: Principal,
  organizationId: string,
  allowedRoles: readonly Role[],
): Promise<{ organizationId: string; isOperator: boolean; roles: Role[] }> {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, isOperator: true },
  });
  if (!organization) throw new AccessError(404, "NOT_FOUND");
  const decision = resolveOrganizationAccess(principal, organization, allowedRoles);
  if (!decision.ok) throw new AccessError(decision.status, decision.status === 404 ? "NOT_FOUND" : "FORBIDDEN");
  return { organizationId: organization.id, isOperator: organization.isOperator, roles: decision.roles };
}

/** Penyaring Prisma untuk data berunit sesuai cakupan akses. */
export function unitWhere(access: Pick<AssessmentAccess, "unitScope">): { unitId?: { in: string[] } } {
  return access.unitScope === null ? {} : { unitId: { in: access.unitScope } };
}
