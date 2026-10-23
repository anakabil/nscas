import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseEnv } from "@/lib/env";

// Satu instans PrismaClient per proses. Saat pengembangan, instans disimpan di
// globalThis agar hot reload Next.js tidak membuka koneksi baru berulang kali.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: getDatabaseEnv().DATABASE_URL });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

export async function pingDatabase(): Promise<void> {
  await getDb().$queryRaw`SELECT 1`;
}
