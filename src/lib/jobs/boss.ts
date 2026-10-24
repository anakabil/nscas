// Antrean tugas latar (pg-boss, docs/02 bagian 6). Proses web hanya mengirim pekerjaan; penjadwalan dan
// pemrosesan dilakukan worker (src/worker.ts). Pekerjaan dapat dikirim di dalam transaksi Prisma yang
// sama dengan perubahan datanya melalui adaptor fromPrisma.

import { fromPrisma, PgBoss } from "pg-boss";
import type { Prisma } from "@/generated/prisma/client";

export const QUEUES = {
  invitationSend: "invitations.send",
  remindersSend: "reminders.send",
  reminderDeliver: "reminders.deliver",
  participationSnapshot: "participation.snapshot",
  reportRender: "report.render",
  retentionScan: "retention.scan",
  actionRemindersSend: "actions.reminders.send",
  actionReminderDeliver: "actions.reminders.deliver",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const QUEUE_OPTIONS = {
  retryLimit: 3,
  retryDelay: 60,
  // Pekerjaan selesai dihapus setelah 7 hari agar data operasional tidak menumpuk.
  deleteAfterSeconds: 7 * 24 * 60 * 60,
};

const globalForBoss = globalThis as unknown as { nscasBoss?: Promise<PgBoss> };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

async function createBoss(role: "sender" | "worker"): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: connectionString(),
    application_name: `nscas-${role}`,
    // Hanya worker yang menjalankan jadwal cron dan pemeliharaan.
    schedule: role === "worker",
    supervise: role === "worker",
  });
  boss.on("error", (error) => console.error("pg-boss:", error.message));
  await boss.start();
  for (const name of Object.values(QUEUES)) {
    if (!(await boss.getQueue(name))) await boss.createQueue(name, QUEUE_OPTIONS);
  }
  return boss;
}

/** Instans pengirim bersama untuk proses web dan tes. */
export function getBoss(): Promise<PgBoss> {
  globalForBoss.nscasBoss ??= createBoss("sender").catch((error) => {
    globalForBoss.nscasBoss = undefined;
    throw error;
  });
  return globalForBoss.nscasBoss;
}

export function createWorkerBoss(): Promise<PgBoss> {
  return createBoss("worker");
}

/**
 * Mengirim pekerjaan. Bila tx diberikan, pekerjaan tersimpan dalam transaksi yang sama dan ikut batal
 * bila transaksi gagal. Skema pg-boss dipastikan ada lebih dulu melalui getBoss().
 */
export async function enqueue(
  tx: Prisma.TransactionClient | null,
  name: QueueName,
  data: Record<string, unknown>,
  options: { singletonKey?: string; startAfter?: Date } = {},
): Promise<void> {
  const boss = await getBoss();
  await boss.send(name, data, { ...options, ...(tx ? { db: fromPrisma(tx) } : {}) });
}

/** Menunggu sampai kosong; untuk tes integrasi dan skrip. */
export async function stopBoss(): Promise<void> {
  const boss = await globalForBoss.nscasBoss;
  globalForBoss.nscasBoss = undefined;
  await boss?.stop({ graceful: true, close: true });
}
