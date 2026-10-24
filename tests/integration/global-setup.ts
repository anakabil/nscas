import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** TEST_DATABASE_URL bila ada; selain itu DATABASE_URL dengan nama basis data diberi akhiran _test. */
function resolveTestDatabaseUrl(): URL {
  config({ quiet: true });
  const raw = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("Set DATABASE_URL or TEST_DATABASE_URL to run integration tests.");
  const url = new URL(raw);
  if (!process.env.TEST_DATABASE_URL) url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  const name = url.pathname.replace(/^\//, "");
  // Pengaman: basis data ini dihapus dan dibuat ulang, jadi tidak boleh basis data pengembangan.
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Refusing to reset database "${name}": test database names must end with _test.`);
  }
  url.pathname = `/${name}`;
  return url;
}

export default async function setup(project: TestProject): Promise<void> {
  const url = resolveTestDatabaseUrl();
  const name = url.pathname.slice(1);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });

  project.provide("databaseUrl", url.toString());
}
