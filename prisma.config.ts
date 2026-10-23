import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Dibiarkan kosong saat `prisma generate` tanpa .env (misalnya di CI).
    url: process.env.DATABASE_URL ?? "",
  },
});
