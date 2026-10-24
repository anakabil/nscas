import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { appUrl, sendMail, type MailMessage } from "@/lib/mail";
import { surveyLink } from "@/lib/privacy/tokens";
import { createAccessToken, decryptRosterEmail } from "@/lib/respondents/service";
import { buildSurveyEmail } from "./email-templates";

// Tugas invitations.send: satu pekerjaan per responden. Token dibuat di sini, tepat sebelum surel dikirim,
// sehingga token mentah hanya ada di memori worker dan di surel; basis data menyimpan hash-nya saja.
// Bila pengiriman gagal, token itu dicabut (SEND_FAILED) dan pg-boss mengulang pekerjaan dengan token baru.

export interface InvitationJob {
  assessmentId: string;
  rosterEntryId: string;
}

export interface MailDeps {
  send: (message: MailMessage) => Promise<void>;
  baseUrl: string;
}

export const defaultMailDeps = (): MailDeps => ({ send: sendMail, baseUrl: appUrl() });

export type DeliveryOutcome = "SENT" | "SKIPPED";

type Tx = Prisma.TransactionClient;

async function lockEntry(tx: Tx, rosterEntryId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "RosterEntry" WHERE "id" = ${rosterEntryId} FOR UPDATE`;
}

export async function deliverInvitation(job: InvitationJob, deps: MailDeps = defaultMailDeps()): Promise<DeliveryOutcome> {
  const db = getDb();
  const prepared = await db.$transaction(async (tx) => {
    await lockEntry(tx, job.rosterEntryId);
    const entry = await tx.rosterEntry.findFirst({
      where: { id: job.rosterEntryId, assessmentId: job.assessmentId },
      select: {
        id: true,
        fullName: true,
        emailEnc: true,
        unitId: true,
        stratumId: true,
        accessTokens: { where: { kind: "SURVEY", revokedAt: null }, select: { id: true } },
        assessment: { select: { status: true, organizationId: true, surveyClosesAt: true, organization: { select: { name: true } } } },
      },
    });
    // Dilewati bila responden dihapus, tanpa surel, sudah memiliki token terpakai, atau distribusi sudah ditutup.
    if (!entry?.emailEnc || entry.accessTokens.length > 0) return null;
    if (entry.assessment.status !== "LOCKED" && entry.assessment.status !== "DATA_COLLECTION") return null;
    const token = await createAccessToken(tx, {
      assessmentId: job.assessmentId,
      unitId: entry.unitId,
      stratumId: entry.stratumId,
      rosterEntryId: entry.id,
      kind: "SURVEY",
      channel: "EMAIL",
    });
    return { entry, token, email: decryptRosterEmail(entry) as string };
  });
  if (!prepared) return "SKIPPED";

  const { entry, token, email } = prepared;
  try {
    await deps.send(
      buildSurveyEmail({
        kind: "invitation",
        to: email,
        name: entry.fullName,
        organization: entry.assessment.organization.name,
        link: surveyLink(deps.baseUrl, token.raw),
        closesAt: entry.assessment.surveyClosesAt,
      }),
    );
  } catch (error) {
    await db.accessToken.update({ where: { id: token.id }, data: { revokedAt: new Date(), revokedReason: "SEND_FAILED" } });
    throw error;
  }

  await db.$transaction((tx) =>
    logAudit(tx, {
      action: "invitation.sent",
      entityType: "RosterEntry",
      entityId: entry.id,
      actor: { id: null },
      organizationId: entry.assessment.organizationId,
      assessmentId: job.assessmentId,
      after: { kind: "invitation" },
    }),
  );
  return "SENT";
}
