import "server-only";
import { createTranslator } from "use-intl/core";
import en from "../../../messages/en.json";
import id from "../../../messages/id.json";
import { DUE_SOON_DAYS, reminderDue, wibDay } from "@/lib/action-plan/rules";
import { PLAN_STATUSES } from "@/lib/action-plan/service";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import type { MailMessage } from "@/lib/mail";
import { PALETTE } from "@/lib/theme";
import { enqueue, QUEUES } from "./boss";
import { defaultMailDeps, type DeliveryOutcome, type MailDeps } from "./invitations";

// Pengingat tenggat tindakan rencana aksi (docs/01 M10). actions.reminders.send berjalan harian pukul 07.00 WIB
// dan mengantre satu pekerjaan per tindakan terbuka yang tenggatnya tinggal 7 hari atau sudah lewat, paling sering
// seminggu sekali per tindakan. Penerima: surel penanggung jawab (bila diisi), administrator klien organisasi, dan
// koordinator unit pelaksana. Jejak audit mencatat jumlah penerima, bukan alamatnya.

const DAY = 24 * 60 * 60 * 1000;

export interface ActionReminderJob {
  actionId: string;
}

export async function scheduleActionReminders(now: Date = new Date()): Promise<number> {
  const horizon = new Date(`${wibDay(new Date(now.getTime() + DUE_SOON_DAYS * DAY))}T00:00:00.000Z`);
  const actions = await getDb().actionItem.findMany({
    where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, dueDate: { lte: horizon }, gapItem: { assessment: { status: { in: [...PLAN_STATUSES] } } } },
    select: { id: true, status: true, dueDate: true, lastReminderAt: true },
  });
  const due = actions.filter((a) => reminderDue(a, now));
  for (const a of due) await enqueue(null, QUEUES.actionReminderDeliver, { actionId: a.id }, { singletonKey: `action-remind:${a.id}:${wibDay(now)}` });
  return due.length;
}

function formatDate(date: Date, locale: "id" | "en"): string {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

export interface ActionReminderEmailInput {
  to: string;
  overdue: boolean;
  organization: string;
  title: string;
  characteristic: string;
  owner: string;
  indicator: string;
  progress: number;
  dueDate: Date;
  link: string;
}

/** Surel dua bahasa (Indonesia lalu Inggris), teks dari messages/*.json namespace actionReminder. */
export function buildActionReminderEmail(input: ActionReminderEmailInput): MailMessage {
  const part = (locale: "id" | "en") => {
    const t = createTranslator({ locale, messages: locale === "id" ? id : en, namespace: "actionReminder" });
    const intro = t(input.overdue ? "overdue" : "dueSoon", { date: formatDate(input.dueDate, locale), organization: input.organization });
    const fields: [string, string][] = [
      [t("fields.action"), input.title],
      [t("fields.characteristic"), input.characteristic],
      [t("fields.owner"), input.owner],
      [t("fields.indicator"), input.indicator],
      [t("fields.progress"), `${input.progress}%`],
    ];
    return {
      subject: t("subject", { title: input.title }),
      text: [t("greeting"), intro, ...fields.map(([k, v]) => `${k}: ${v}`), t("linkIntro"), input.link, t("closing"), t("signature")].join("\n\n"),
      html: [
        `<p>${escapeHtml(t("greeting"))}</p>`,
        `<p>${escapeHtml(intro)}</p>`,
        `<table style="border-collapse:collapse">${fields.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:${PALETTE.textMuted}">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join("")}</table>`,
        `<p><a href="${escapeHtml(input.link)}" style="display:inline-block;background:${PALETTE.navy};color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(t("button"))}</a></p>`,
        `<p>${escapeHtml(t("closing"))}<br>${escapeHtml(t("signature"))}</p>`,
      ].join(""),
    };
  };
  const [idPart, enPart] = [part("id"), part("en")];
  return {
    to: input.to,
    subject: idPart.subject,
    text: `${idPart.text}\n\n---\n\n${enPart.text}`,
    html: `${idPart.html}<hr style="border:none;border-top:1px solid ${PALETTE.border};margin:24px 0">${enPart.html}`,
  };
}

export async function deliverActionReminder(job: ActionReminderJob, deps: MailDeps = defaultMailDeps(), now: Date = new Date()): Promise<DeliveryOutcome> {
  const db = getDb();
  const action = await db.actionItem.findUnique({
    where: { id: job.actionId },
    select: {
      id: true,
      title: true,
      ownerName: true,
      ownerPosition: true,
      ownerEmail: true,
      unitId: true,
      dueDate: true,
      status: true,
      successIndicator: true,
      lastReminderAt: true,
      updates: { orderBy: { createdAt: "desc" }, take: 1, select: { progressPercent: true } },
      gapItem: {
        select: {
          characteristic: { select: { code: true, nameId: true } },
          assessment: { select: { id: true, status: true, organizationId: true, organization: { select: { name: true } } } },
        },
      },
    },
  });
  if (!action || !reminderDue(action, now) || !PLAN_STATUSES.includes(action.gapItem.assessment.status)) return "SKIPPED";
  const assessment = action.gapItem.assessment;
  const memberships = await db.membership.findMany({
    where: { organizationId: assessment.organizationId, role: { in: ["CLIENT_ADMIN", "UNIT_COORDINATOR"] }, user: { isActive: true } },
    select: { role: true, unitScope: true, user: { select: { email: true } } },
  });
  const recipients = new Set<string>();
  if (action.ownerEmail) recipients.add(action.ownerEmail.toLowerCase());
  for (const m of memberships) {
    if (m.role === "CLIENT_ADMIN" || (action.unitId && m.unitScope.includes(action.unitId))) recipients.add(m.user.email.toLowerCase());
  }
  if (recipients.size === 0) return "SKIPPED";
  const overdue = action.dueDate.toISOString().slice(0, 10) < wibDay(now);
  for (const to of recipients) {
    await deps.send(
      buildActionReminderEmail({
        to,
        overdue,
        organization: assessment.organization.name,
        title: action.title,
        characteristic: `${action.gapItem.characteristic.code} ${action.gapItem.characteristic.nameId}`,
        owner: `${action.ownerName}, ${action.ownerPosition}`,
        indicator: action.successIndicator,
        progress: action.updates[0]?.progressPercent ?? 0,
        dueDate: action.dueDate,
        link: `${deps.baseUrl}/assessments/${assessment.id}/gaps`,
      }),
    );
  }
  await db.$transaction(async (tx) => {
    await tx.actionItem.update({ where: { id: action.id }, data: { lastReminderAt: now } });
    await logAudit(tx, {
      action: "action.reminder_sent",
      entityType: "ActionItem",
      entityId: action.id,
      organizationId: assessment.organizationId,
      assessmentId: assessment.id,
      after: { overdue, recipients: recipients.size, dueDate: action.dueDate.toISOString().slice(0, 10) },
    });
  });
  return "SENT";
}
