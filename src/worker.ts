// Proses worker pg-boss (docs/02 bagian 6). Dijalankan terpisah dari server web dengan image yang sama:
//   npm run worker
// Kondisi react-server dipakai agar modul bertanda "server-only" dapat dimuat di luar Next.js. Worker berjalan
// sebagai satu proses Node (loader tsx), sehingga SIGTERM dari Docker langsung menghentikannya dengan rapi.

import type { Job } from "pg-boss";
import { createWorkerBoss, QUEUES } from "@/lib/jobs/boss";
import { deliverInvitation, type InvitationJob } from "@/lib/jobs/invitations";
import { deliverReminder, scheduleReminders, type ReminderJob } from "@/lib/jobs/reminders";
import { takeParticipationSnapshots } from "@/lib/respondents/participation-data";

const TZ = "Asia/Jakarta";

async function main() {
  const boss = await createWorkerBoss();

  await boss.schedule(QUEUES.remindersSend, "0 8 * * *", null, { tz: TZ });
  await boss.schedule(QUEUES.participationSnapshot, "0 23 * * *", null, { tz: TZ });

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
