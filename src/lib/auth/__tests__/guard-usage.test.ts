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
  // Pemindaian kode QR unit oleh responden tanpa akun (docs/01 M2).
  ["src/app/q/[code]/route.ts", "survey-qr"],
  // Survei responden bertoken tanpa akun (docs/01 M3, docs/02 bagian 4).
  ["src/app/s/[token]/submit/route.ts", "survey-token"],
  ["src/app/s/[token]/open/route.ts", "survey-token"],
  // Penilaian mandiri bertoken tanpa akun (docs/01 M4).
  ["src/app/sa/[token]/answer/route.ts", "self-assessment-token"],
  ["src/app/sa/[token]/profile/route.ts", "self-assessment-token"],
  ["src/app/sa/[token]/submit/route.ts", "self-assessment-token"],
  // Berkas statis aplikasi observasi yang dapat dipasang (PWA), tanpa data.
  ["src/app/o/manifest.webmanifest/route.ts", "pwa-manifest"],
  ["src/app/o/sw.js/route.ts", "pwa-service-worker"],
]);

// Halaman tanpa sesi. Setiap entri disertai alasan; halaman bertoken wajib memverifikasi tokennya di server.
const PUBLIC_PAGES = new Map([
  ["src/app/page.tsx", "beranda tanpa data"],
  ["src/app/(auth)/login/page.tsx", "formulir masuk"],
  ["src/app/(auth)/login/verify/page.tsx", "formulir kode TOTP; verifikasi di Server Action masuk"],
  ["src/app/forbidden/page.tsx", "pesan akses ditolak"],
  ["src/app/health/page.tsx", "status basis data dan penyimpanan tanpa data asesmen"],
  ["src/app/q/unavailable/page.tsx", "pesan kode QR tidak berlaku"],
  ["src/app/s/[token]/page.tsx", "survei bertoken"],
  ["src/app/sa/[token]/page.tsx", "penilaian mandiri bertoken"],
]);
const TOKEN_VERIFIERS: Record<string, RegExp> = {
  "src/app/s/[token]/page.tsx": /resolveSurveyToken\(/,
  "src/app/sa/[token]/page.tsx": /resolveSelfAssessmentToken\(/,
};

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
const pages = files.filter((f) => /\/page\.tsx$/.test(f.path));

describe("pemakaian guard", () => {
  it("menemukan Server Action dan Route Handler untuk diperiksa", () => {
    expect(serverActions.length).toBeGreaterThan(0);
    expect(routeHandlers.length).toBeGreaterThan(0);
  });

  it.each([...serverActions, ...routeHandlers].map((f) => [f.path, f] as const))("%s memakai guard", (path, file) => {
    if (ALLOWED_EXEMPTIONS.has(path)) {
      // Pengecualian yang disetujui tetap harus ditandai di berkasnya.
      if (path.endsWith("actions.ts") || /^src\/app\/(q|s|sa|o)\//.test(path)) {
        expect(file.content).toContain(`guard-exempt: ${ALLOWED_EXEMPTIONS.get(path)}`);
      }
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

describe("pemakaian guard pada halaman", () => {
  it.each(pages.map((f) => [f.path, f] as const))("%s memeriksa hak akses atau terdaftar sebagai halaman publik", (path, file) => {
    if (PUBLIC_PAGES.has(path)) {
      const verifier = TOKEN_VERIFIERS[path];
      if (verifier) expect(file.content).toMatch(verifier);
      expect(file.content).not.toMatch(/getDb\(/);
      return;
    }
    // Halaman konfigurasi memakai requireConfigurationPage (src/lib/assessments/page-access.ts) yang memanggil requireRole.
    expect(file.content).toMatch(/\b(require(Role|User|OrganizationRole|SuperAdmin)|requireConfigurationPage)\(/);
  });

  it("halaman yang membaca data asesmen berdasarkan id memakai requireRole", () => {
    for (const f of pages.filter((p) => p.path.includes("assessments/[id]/"))) {
      expect(f.content, f.path).toMatch(/requireRole\(|requireConfigurationPage\(/);
    }
  });

  it("daftar halaman publik tidak memuat halaman yang sudah tidak ada", () => {
    const paths = new Set(pages.map((p) => p.path));
    for (const path of PUBLIC_PAGES.keys()) expect(paths.has(path), path).toBe(true);
  });
});
