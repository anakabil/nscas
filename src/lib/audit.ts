import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

// Jejak audit (CLAUDE.md aturan 6, docs/04 bagian 6). logAudit wajib dipanggil dengan klien transaksi
// dari prisma.$transaction yang sama dengan perubahan data, sehingga catatan audit dan perubahannya
// tersimpan atau batal bersama.

export type AuditAction =
  // Akses
  | "auth.login"
  | "auth.login_failed"
  | "auth.account_locked"
  | "auth.account_unlocked"
  | "auth.logout"
  | "auth.totp_enabled"
  | "auth.totp_reset"
  | "auth.backup_codes_regenerated"
  | "auth.backup_code_used"
  | "auth.password_changed"
  | "auth.password_reset"
  | "membership.role_grant"
  | "membership.role_revoke"
  // Pengguna dan organisasi
  | "user.create"
  | "user.activate"
  | "user.deactivate"
  | "organization.create"
  // Konfigurasi asesmen (docs/01 M1) dan transisi status
  | "assessment.create"
  | "assessment.update"
  | "assessment.parameters_update"
  | "assessment.sample_plan_saved"
  | "assessment.status_change"
  | "unit.create"
  | "unit.update"
  | "unit.delete"
  | "stratum.create"
  | "stratum.update"
  | "stratum.delete"
  | "assignment.create"
  | "assignment.delete"
  // Manajemen responden dan distribusi token (docs/01 M2, docs/04 bagian 6)
  | "assessment.survey_window"
  | "roster.import"
  | "token.issue"
  | "token.revoke"
  | "token.reissue"
  | "invitation.queue"
  | "invitation.sent"
  | "reminder.sent"
  | "qr.create"
  | "qr.deactivate"
  // Penilaian mandiri (docs/01 M4); pengisi tanpa akun dicatat dengan pelaku kosong
  | "selfAssessment.issue"
  | "selfAssessment.revoke"
  | "selfAssessment.reissue"
  | "selfAssessment.profile_update"
  | "selfAssessment.answer_save"
  | "selfAssessment.submit";

export interface AuditActor {
  id: string | null;
  role?: Role | null;
}

export interface RequestMeta {
  ipHash: string | null;
  userAgent: string | null;
}

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  actor?: AuditActor;
  organizationId?: string | null;
  assessmentId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: RequestMeta;
}

/** Kunci yang berisi rahasia: memuat "password" atau "secret", atau berakhiran Hash, Enc, atau Token. */
const SENSITIVE_KEY = /password|secret|(hash|enc|token)$/i;

/** Membuang nilai rahasia dari before/after agar jejak audit tidak pernah memuat kredensial. */
export function redactForAudit(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => {
      if (SENSITIVE_KEY.test(key)) return [key, "[disembunyikan]"];
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        return [key, redactForAudit(v as Record<string, unknown>)];
      }
      return [key, v];
    }),
  );
}

type TransactionClient = Prisma.TransactionClient;

export async function logAudit(tx: TransactionClient, entry: AuditEntry): Promise<void> {
  // Menolak pemanggilan di luar transaksi. Pada Prisma 7, klien transaksi tetap memiliki $transaction
  // tetapi tidak memiliki $connect (diverifikasi oleh tests/integration/auth.test.ts).
  if (typeof (tx as unknown as Record<string, unknown>).$connect === "function") {
    throw new Error("logAudit must be called with the transaction client inside prisma.$transaction");
  }
  await tx.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      actorId: entry.actor?.id ?? null,
      actorRole: entry.actor?.role ?? null,
      organizationId: entry.organizationId ?? null,
      assessmentId: entry.assessmentId ?? null,
      before: entry.before ? (redactForAudit(entry.before) as Prisma.InputJsonObject) : undefined,
      after: entry.after ? (redactForAudit(entry.after) as Prisma.InputJsonObject) : undefined,
      ipHash: entry.meta?.ipHash ?? null,
      userAgent: entry.meta?.userAgent ?? null,
    },
  });
}
