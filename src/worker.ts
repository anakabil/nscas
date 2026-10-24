// Proses worker pg-boss (docs/02 bagian 6). Dijalankan terpisah dari server web dengan image yang sama:
//   npm run worker
// Kondisi react-server dipakai agar modul bertanda "server-only" dapat dimuat di luar Next.js. Worker berjalan
// sebagai satu proses Node (loader tsx), sehingga SIGTERM dari Docker langsung menghentikannya dengan rapi.

import type { Job } from "pg-boss";
import { deliverActionReminder, scheduleActionReminders, type ActionReminderJob } from "@/lib/jobs/action-reminders";
import { createWorkerBoss, QUEUES } from "@/lib/jobs/boss";
import { processDestruction, type DestructionJob } from "@/lib/jobs/destruction";
import { deliverInvitation, type InvitationJob } from "@/lib/jobs/invitations";
import { deliverReminder, scheduleReminders, type ReminderJob } from "@/lib/jobs/reminders";
import { renderReport, type ReportRenderJob } from "@/lib/jobs/report-render";
import { takeParticipationSnapshots } from "@/lib/respondents/participation-data";
import { scanRetention } from "@/lib/retention/service";

const TZ = "Asia/Jakarta";

async function main() {
  const boss = await createWorkerBoss();

  await boss.schedule(QUEUES.remindersSend, "0 8 * * *", null, { tz: TZ });
  await boss.schedule(QUEUES.participationSnapshot, "0 23 * * *", null, { tz: TZ });
  await boss.schedule(QUEUES.actionRemindersSend, "0 7 * * *", null, { tz: TZ });
  // Pemeriksaan masa simpan mingguan, Senin pukul 06.00 WIB (docs/04 bagian 7).
  await boss.schedule(QUEUES.retentionScan, "0 6 * * 1", null, { tz: TZ });

  // Pengiriman surel dibatasi beberapa sekaligus agar tidak membebani server SMTP.
  await boss.work<InvitationJob>(QUEUES.invitationSend, { localConcurrency: 4 }, async ([job]: Job<InvitationJob>[]) => {
    await deliverInvitation(job.data);
  });
  await boss.work<ReminderJob>(QUEUES.reminderDeliver, { localConcurrency: 4 }, async ([job]: Job<ReminderJob>[]) => {
    await deliverReminder(job.data);
  });
  await boss.work(QUEUES.remindersSend, async () => {
    const queued = await scheduleReminders();
    console.info(`reminders.send: ${queued} pengingat diantre`);
  });
  await boss.work(QUEUES.participationSnapshot, async () => {
    const count = await takeParticipationSnapshots();
    console.info(`participation.snapshot: ${count} asesmen`);
  });

  await boss.work<ActionReminderJob>(QUEUES.actionReminderDeliver, { localConcurrency: 2 }, async ([job]: Job<ActionReminderJob>[]) => {
    await deliverActionReminder(job.data);
  });
  await boss.work(QUEUES.actionRemindersSend, async () => {
    const queued = await scheduleActionReminders();
    console.info(`actions.reminders.send: ${queued} pengingat tenggat diantre`);
  });

  // Satu render sekaligus: Chromium memerlukan memori yang cukup besar.
  await boss.work<ReportRenderJob>(QUEUES.reportRender, { localConcurrency: 1 }, async ([job]: Job<ReportRenderJob>[]) => {
    const outcome = await renderReport(job.data);
    console.info(`report.render ${job.data.reportId}: ${outcome}`);
  });

  await boss.work(QUEUES.retentionScan, async () => {
    const flagged = await scanRetention();
    console.info(`retention.scan: ${flagged} asesmen melewati masa simpan`);
  });
  await boss.work<DestructionJob>(QUEUES.destructionProcess, { localConcurrency: 1 }, async ([job]: Job<DestructionJob>[]) => {
    const outcome = await processDestruction(job.data);
    console.info(`destruction.process ${job.data.recordId}: ${outcome}`);
  });

  console.info("Worker NSCAS berjalan.");
  const shutdown = async () => {
    await boss.stop({ graceful: true, close: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
