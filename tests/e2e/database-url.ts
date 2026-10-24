import { config } from "dotenv";

config({ quiet: true });

/** E2E_DATABASE_URL bila ada; selain itu DATABASE_URL dengan nama basis data diberi akhiran _e2e. */
export function e2eDatabaseUrl(): string {
  const raw = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("Set DATABASE_URL or E2E_DATABASE_URL to run e2e tests.");
  const url = new URL(raw);
  if (!process.env.E2E_DATABASE_URL) url.pathname = `${url.pathname.replace(/^\//, "")}_e2e`;
  const name = url.pathname.replace(/^\//, "");
  // Pengaman: basis data ini dihapus dan dibuat ulang, jadi tidak boleh basis data pengembangan.
  if (!/^[a-z0-9_]+_e2e$/.test(name)) throw new Error(`Refusing to reset database "${name}": e2e database names must end with _e2e.`);
  url.pathname = `/${name}`;
  return url.toString();
}
