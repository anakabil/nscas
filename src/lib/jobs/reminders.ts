import "server-only";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { surveyLink } from "@/lib/privacy/tokens";
import { createAccessToken, decryptRosterEmail, isSurveyOpen } from "@/lib/respondents/service";
import { enqueue, QUEUES } from "./boss";
import { buildSurveyEmail } from "./email-templates";
import { defaultMailDeps, type DeliveryOutcome, type MailDeps } from "./invitations";

// Pengingat survei (docs/01 M2, docs/02 bagian 6). reminders.send berjalan harian pukul 08.00 WIB dan
// mengantre reminders.deliver per token yang belum selesai, hanya untuk undangan surel, paling banyak tiga
// kali per responden dengan jarak paling sedikit tiga hari.
//
// Karena token mentah tidak disimpan, pengingat untuk token yang belum dibuka memuat token baru dan token
// lama dicabut (ROTATED_REMINDER) setelah surel terkirim. Token yang sudah dibuka tidak diganti agar draf di
// perangkat responden tetap terpakai; pengingatnya meminta responden melanjutkan dari tautan semula.

export const MAX_REMINDERS = 3;
export const REMINDER_GAP_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

export interface ReminderJob {
  tokenId: string;
}

/** Token yang boleh diingatkan pada waktu now; dipakai penjadwal dan pemeriksaan ulang saat pengiriman. */
export function reminderEligibility(
  token: { revokedAt: Date | null; completedAt: Date | null; reminderCount: number; issuedAt: Date; lastReminderAt: Date | null; channel: string | null },
  now: Date,
): boolean {
  if (token.revokedAt || token.completedAt || token.channel !== "EMAIL") return false;
  if (token.reminderCount >= MAX_REMINDERS) return false;
  return (token.lastReminderAt ?? token.issuedAt).getTime() <= now.getTime() - REMINDER_GAP_DAYS * DAY;
}

/** Penjadwal harian: mengantre satu pekerjaan per token yang memenuhi syarat. Mengembalikan jumlahnya. */
export async function scheduleReminders(now: Date = new Date()): Promise<number> {
  const db = getDb();
  const assessments = await db.assessment.findMany({
    where: { status: "DATA_COLLECTION" },
    select: { id: true, status: true, surveyOpensAt: true, surveyClosesAt: true },
  });
  let queued = 0;
  for (const a of assessments.filter((x) => isSurveyOpen(x, now))) {
    const tokens = await db.accessToken.findMany({
      where: {
        assessmentId: a.id,
        kind: "SURVEY",
        channel: "EMAIL",
        revokedAt: null,
        completedAt: null,
        rosterEntryId: { not: null },
        reminderCount: { lt: MAX_REMINDERS },
        OR: [
          { lastReminderAt: { lte: new Date(now.getTime() - REMINDER_GAP_DAYS * DAY) } },
          { lastReminderAt: null, issuedAt: { lte: new Date(now.getTime() - REMINDER_GAP_DAYS * DAY) } },
        ],
      },
      select: { id: true, reminderCount: true },
    });
    for (const t of tokens) {
      await enqueue(null, QUEUES.reminderDeliver, { tokenId: t.id }, { singletonKey: `remind:${t.id}:${t.reminderCount + 1}` });
    }
    queued += tokens.length;
  }
  return queued;
}

export async function deliverReminder(job: ReminderJob, deps: MailDeps = defaultMailDeps(), now: Date = new Date()): Promise<DeliveryOutcome> {
  const db = getDb();
  const prepared = await db.$transaction(async (tx) => {
    const found = await tx.accessToken.findUnique({ where: { id: job.tokenId }, select: { rosterEntryId: true } });
    if (!found?.rosterEntryId) return null;
    await tx.$queryRaw`SELECT "id" FROM "RosterEntry" WHERE "id" = ${found.rosterEntryId} FOR UPDATE`;

    const token = await tx.accessToken.findUnique({
      where: { id: job.tokenId },
      select: {
        id: true,
        assessmentId: true,
        unitId: true,
        stratumId: true,
        issuedAt: true,
        firstOpenedAt: true,
        completedAt: true,
        revokedAt: true,
        reminderCount: true,
        lastReminderAt: true,
        channel: true,
        rosterEntry: {
          select: {
            id: true,
            fullName: true,
            emailEnc: true,
            accessTokens: { where: { kind: "SURVEY", OR: [{ revokedAt: null }, { completedAt: { not: null } }] }, select: { id: true, completedAt: true } },
          },
        },
        assessment: { select: { status: true, organizationId: true, surveyOpensAt: true, surveyClosesAt: true, organization: { select: { name: true } } } },
      },
    });
    const entry = token?.rosterEntry;
    if (!token || !entry?.emailEnc || !reminderEligibility(token, now) || !isSurveyOpen(token.assessment, now)) return null;
    // Responden yang sudah menyelesaikan survei dengan token mana pun tidak diingatkan.
    if (entry.accessTokens.some((t) => t.completedAt)) return null;

    // Token lain yang masih aktif (misalnya sisa percobaan yang terhenti) dicabut agar satu responden
    // tidak memegang dua token sah.
    const strays = entry.accessTokens.filter((t) => t.id !== token.id).map((t) => t.id);
    if (strays.length > 0) await tx.accessToken.updateMany({ where: { id: { in: strays } }, data: { revokedAt: now, revokedReason: "ROTATED_REMINDER" } });

    const count = token.reminderCount + 1;
    const rotated = token.firstOpenedAt
      ? null
      : await createAccessToken(tx, {
          assessmentId: token.assessmentId,
          unitId: token.unitId,
          stratumId: token.stratumId,
          rosterEntryId: entry.id,
          kind: "SURVEY",
          channel: "EMAIL",
          reminderCount: count,
          lastReminderAt: now,
        });
    return { token, entry, rotated, count, email: decryptRosterEmail(entry) as string };
  });
  if (!prepared) return "SKIPPED";

  const { token, entry, rotated, count, email } = prepared;
  try {
    await deps.send(
      buildSurveyEmail({
        kind: rotated ? "reminder" : "continue",
        to: email,
        name: entry.fullName,
        organization: token.assessment.organization.name,
        link: rotated ? surveyLink(deps.baseUrl, rotated.raw) : null,
        closesAt: token.assessment.surveyClosesAt,
      }),
    );
  } catch (error) {
    if (rotated) await db.accessToken.update({ where: { id: rotated.id }, data: { revokedAt: new Date(), revokedReason: "SEND_FAILED" } });
    throw error;
  }

  await db.$transaction(async (tx) => {
    if (rotated) {
      const old = await tx.accessToken.findUniqueOrThrow({ where: { id: token.id }, select: { firstOpenedAt: true, completedAt: true, revokedAt: true } });
      if (old.firstOpenedAt || old.completedAt) {
        // Responden membuka tautan lama saat pengingat sedang dikirim: tautan lama tetap berlaku.
        await tx.accessToken.update({ where: { id: rotated.id }, data: { revokedAt: new Date(), revokedReason: "ROTATED_REMINDER" } });
      } else if (!old.revokedAt) {
        await tx.accessToken.update({ where: { id: token.id }, data: { revokedAt: new Date(), revokedReason: "ROTATED_REMINDER" } });
      }
    } else {
      await tx.accessToken.update({ where: { id: token.id }, data: { reminderCount: count, lastReminderAt: now } });
    }
    await logAudit(tx, {
      action: "reminder.sent",
      entityType: "RosterEntry",
      entityId: entry.id,
      actor: { id: null },
      organizationId: token.assessment.organizationId,
      assessmentId: token.assessmentId,
      after: { kind: rotated ? "reminder" : "continue", reminderNumber: count },
    });
  });
  return "SENT";
}
