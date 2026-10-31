// Penjalan seed: npm run db:seed (prisma db seed).
// Membaca DATABASE_URL, SEED_ADMIN_EMAIL, dan SEED_ADMIN_PASSWORD dari .env. SEED_DEMO_ORGANIZATION=true menambahkan
// organisasi demo kosong untuk pengembangan; bawaannya tidak, agar sistem pengukuran sungguhan tetap bersih.

import "dotenv/config";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDatabase } from "./seeding";

async function main(): Promise<void> {
  const { DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env to create the SUPER_ADMIN user.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  try {
    await seedDatabase(prisma, {
      seedDir: join(__dirname, "..", "seed"),
      admin: { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD, name: SEED_ADMIN_NAME || undefined },
      demoOrganization: process.env.SEED_DEMO_ORGANIZATION === "true",
      log: (message) => console.info(message),
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
