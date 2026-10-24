// CLAUDE.md aturan 4: setiap Server Action dan Route Handler wajib memeriksa hak akses di server
// melalui src/lib/auth/guard.ts. Pengecualian harus dinyatakan dengan komentar "guard-exempt: <alasan>".

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..", "..");
const APP = join(ROOT, "src", "app");
const ALLOWED_EXEMPTIONS = new Map([
  ["src/app/(auth)/login/actions.ts", "login"],
  ["src/app/api/auth/[...nextauth]/route.ts", "auth.js"],
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(APP)
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => ({ path: relative(ROOT, f), content: readFileSync(f, "utf8") }));
const serverActions = files.filter((f) => /^\s*["']use server["']/m.test(f.content));
const routeHandlers = files.filter((f) => /\/route\.ts$/.test(f.path));

describe("pemakaian guard", () => {
  it("menemukan Server Action dan Route Handler untuk diperiksa", () => {
    expect(serverActions.length).toBeGreaterThan(0);
    expect(routeHandlers.length).toBeGreaterThan(0);
  });

  it.each([...serverActions, ...routeHandlers].map((f) => [f.path, f] as const))("%s memakai guard", (path, file) => {
    if (ALLOWED_EXEMPTIONS.has(path)) {
      // Pengecualian yang disetujui tetap harus ditandai di berkasnya.
      if (path.endsWith("actions.ts")) expect(file.content).toContain(`guard-exempt: ${ALLOWED_EXEMPTIONS.get(path)}`);
      return;
    }
    if (path === "src/app/health/route.ts") return;
    expect(file.content).toMatch(/from "@\/lib\/auth\/guard"/);
    expect(file.content).toMatch(/\brequire(Role|User|OrganizationRole|SuperAdmin)\(/);
  });

  it("tidak ada Route Handler data yang membaca basis data tanpa guard", () => {
    for (const f of routeHandlers) {
      if (ALLOWED_EXEMPTIONS.has(f.path)) continue;
      if (/getDb\(/.test(f.content)) expect(f.content, f.path).toMatch(/requireRole\(|requireOrganizationRole\(/);
    }
  });
});
