import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { inject } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";

export const SEED_DIR = join(__dirname, "..", "..", "seed");

export function createTestClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: inject("databaseUrl") }) });
}
