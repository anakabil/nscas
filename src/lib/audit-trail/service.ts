import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { logAudit, type RequestMeta } from "@/lib/audit";
import type { AssessmentAccess } from "@/lib/auth/access";
import { AUDIT_ROLES } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { toCsv } from "./csv";

// Pembacaan dan ekspor jejak audit satu asesmen (docs/04 bagian 6). Tabel AuditLog hanya dibaca di sini;
// penulisan tetap melalui src/lib/audit.ts.

export const AUDIT_PAGE_LIMIT = 200;
export const AUDIT_EXPORT_LIMIT = 50_000;

type Access = Pick<AssessmentAccess, "assessmentId" | "organizationId" | "roles">;

export interface AuditTrailEntry {
  id: string;
  at: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: Role | null;
  /** Hanya untuk pembaca isi lengkap; null bagi administrator klien. */
  detail: { before: unknown; after: unknown; ipHash: string | null; userAgent: string | null } | null;
}

export function canReadFullAudit(roles: readonly Role[]): boolean {
  return roles.some((r) => (AUDIT_ROLES.full as readonly Role[]).includes(r));
}

/** Penyaring tenant: catatan asesmen ini milik organisasinya, atau dari tugas sistem tanpa organisasi. */
function auditWhere(access: Access): Prisma.AuditLogWhereInput {
  return { assessmentId: access.assessmentId, OR: [{ organizationId: access.organizationId }, { organizationId: null }] };
}

async function entries(access: Access, take: number, full: boolean): Promise<AuditTrailEntry[]> {
  const db = getDb();
  const rows = await db.auditLog.findMany({ where: auditWhere(access), orderBy: [{ at: "desc" }, { id: "desc" }], take });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => id !== null))];
  const users = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const user = r.actorId ? byId.get(r.actorId) : undefined;
    return {
      id: r.id,
      at: r.at,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorName: user?.name ?? null,
      actorEmail: full ? (user?.email ?? null) : null,
      actorRole: r.actorRole,
      detail: full ? { before: r.before, after: r.after, ipHash: r.ipHash, userAgent: r.userAgent } : null,
    };
  });
}

export async function loadAuditTrail(access: Access) {
  const full = canReadFullAudit(access.roles);
  const [total, list] = await Promise.all([getDb().auditLog.count({ where: auditWhere(access) }), entries(access, AUDIT_PAGE_LIMIT, full)]);
  return { total, entries: list, full };
}

export type AuditCsvLabels = Record<"at" | "atWib" | "action" | "entityType" | "entityId" | "actor" | "actorEmail" | "role" | "ipHash" | "userAgent" | "before" | "after", string>;

export function auditCsv(list: readonly AuditTrailEntry[], labels: AuditCsvLabels, timeZone: string, systemLabel: string): string {
  const header = [labels.at, labels.atWib, labels.action, labels.entityType, labels.entityId, labels.actor, labels.actorEmail, labels.role, labels.ipHash, labels.userAgent, labels.before, labels.after];
  const json = (v: unknown) => (v === null || v === undefined ? "" : JSON.stringify(v));
  // Ekspor diurutkan dari yang terlama agar mudah ditelusuri secara kronologis.
  const rows = [...list].reverse().map((e) => [
    e.at.toISOString(),
    formatDateTime(e.at, timeZone),
    e.action,
    e.entityType,
    e.entityId,
    e.actorName ?? systemLabel,
    e.actorEmail,
    e.actorRole,
    e.detail?.ipHash,
    e.detail?.userAgent,
    json(e.detail?.before),
    json(e.detail?.after),
  ]);
  return toCsv([header, ...rows]);
}

/** Ekspor CSV lengkap untuk lead assessor; ekspor itu sendiri dicatat sebagai audit.export. */
export async function exportAuditTrail(access: Access & { actorId: string }, labels: AuditCsvLabels, timeZone: string, systemLabel: string, meta: RequestMeta) {
  const list = await entries(access, AUDIT_EXPORT_LIMIT, true);
  const csv = auditCsv(list, labels, timeZone, systemLabel);
  await getDb().$transaction((tx) =>
    logAudit(tx, {
      action: "audit.export",
      entityType: "Assessment",
      entityId: access.assessmentId,
      actor: { id: access.actorId, role: "LEAD_ASSESSOR" },
      organizationId: access.organizationId,
      assessmentId: access.assessmentId,
      after: { rows: list.length },
      meta,
    }),
  );
  return { csv, rows: list.length };
}
