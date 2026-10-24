import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import {
  AccessError,
  authorizeAssessmentAccess,
  authorizeOrganizationAccess,
  type AssessmentAccess,
} from "./access";
import { getSessionContext, type SessionContext } from "./session";

// Pemeriksaan hak akses di server (CLAUDE.md aturan 4, docs/04 bagian 2).
// Setiap Server Action dan Route Handler wajib memanggil salah satu fungsi require* di bawah ini;
// tes src/lib/auth/__tests__/guard-usage.test.ts memastikannya.

export { AccessError, unitWhere } from "./access";

/**
 * Pengguna yang sudah masuk. Secara bawaan menolak sesi yang masih wajib mengaktifkan TOTP
 * atau mengganti kata sandi sementara; halaman pengaturan akun memakai allowSetupPending.
 */
export async function requireUser(options: { allowSetupPending?: boolean } = {}): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) throw new AccessError(401, "UNAUTHENTICATED");
  if (!options.allowSetupPending && (session.totpPending || session.user.mustChangePassword)) {
    throw new AccessError(403, "SETUP_REQUIRED");
  }
  return session;
}

export interface GuardedAssessment extends AssessmentAccess {
  session: SessionContext;
}

/**
 * Memeriksa keanggotaan organisasi, penugasan asesmen, dan cakupan unit.
 * Melempar AccessError 401, 403, atau 404. Pemanggil wajib menyaring data berunit dengan unitWhere(access).
 */
export async function requireRole(
  assessmentId: string,
  allowedRoles: readonly Role[],
  options: { unitId?: string | null } = {},
): Promise<GuardedAssessment> {
  const session = await requireUser();
  const access = await authorizeAssessmentAccess(getDb(), session.principal, assessmentId, allowedRoles, options);
  return { ...access, session };
}

export async function requireOrganizationRole(organizationId: string, allowedRoles: readonly Role[]) {
  const session = await requireUser();
  const access = await authorizeOrganizationAccess(getDb(), session.principal, organizationId, allowedRoles);
  return { ...access, session };
}

export async function requireSuperAdmin(): Promise<SessionContext> {
  const session = await requireUser();
  if (!session.principal.isSuperAdmin) throw new AccessError(403, "FORBIDDEN");
  return session;
}

/** Peran utama pelaku untuk dicatat di jejak audit. */
export function primaryRole(roles: readonly Role[]): Role | null {
  return roles[0] ?? null;
}

/** Untuk Route Handler: mengubah AccessError menjadi respons JSON berkode status yang sesuai. */
export function accessErrorResponse(error: unknown): Response {
  if (error instanceof AccessError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  throw error;
}

/** Untuk halaman: mengalihkan ke halaman masuk, pengaturan akun, halaman tidak ditemukan, atau akses ditolak. */
export async function guardPage<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (error.status === 401) redirect("/login");
    if (error.code === "SETUP_REQUIRED") redirect("/account");
    if (error.status === 404) notFound();
    redirect("/forbidden");
  }
}
