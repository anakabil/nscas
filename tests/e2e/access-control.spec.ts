// Tes e2e hak akses yang diminta Fase 3 (CLAUDE.md aturan 4, docs/04 bagian 2).

import { expect, test, type BrowserContext } from "@playwright/test";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

// Dibaca di beforeAll karena berkas data uji baru dibuat saat server uji disiapkan.
let f: Fixtures;
const contexts: Record<string, BrowserContext> = {};

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  for (const key of ["adminA", "coordinatorA", "superAdmin"]) {
    const context = await browser.newContext();
    await login(await context.newPage(), key);
    contexts[key] = context;
  }
});

test.afterAll(async () => {
  await Promise.all(Object.values(contexts).map((c) => c.close()));
});

test("pengguna organisasi A tidak dapat membaca asesmen organisasi B", async () => {
  const api = contexts.adminA.request;
  const own = await api.get(`/api/assessments/${f.assessments.a}`);
  expect(own.status()).toBe(200);
  expect((await own.json()).assessment.id).toBe(f.assessments.a);

  // Asesmen organisasi lain diperlakukan sebagai tidak ada agar keberadaannya tidak terungkap.
  expect((await api.get(`/api/assessments/${f.assessments.b}`)).status()).toBe(404);
  expect((await api.get(`/api/assessments/${f.assessments.b}/respondents`)).status()).toBe(404);
  expect((await api.get(`/api/assessments/${f.assessments.b}/units/${f.units.b1}`)).status()).toBe(404);

  const page = await contexts.adminA.newPage();
  const response = await page.goto(`/assessments/${f.assessments.b}`);
  expect(response?.status()).toBe(404);
  await page.goto("/assessments");
  await expect(page.getByRole("link", { name: "Asesmen Budaya K3 Alfa 2026" })).toBeVisible();
  await expect(page.getByText("Asesmen Budaya K3 Beta 2026")).toHaveCount(0);
});

test("koordinator unit tidak dapat membaca unit lain", async () => {
  const api = contexts.coordinatorA.request;
  const own = await api.get(`/api/assessments/${f.assessments.a}/units/${f.units.a1}`);
  expect(own.status()).toBe(200);
  expect((await own.json()).unit.id).toBe(f.units.a1);

  expect((await api.get(`/api/assessments/${f.assessments.a}/units/${f.units.a2}`)).status()).toBe(403);
  expect((await api.get(`/api/assessments/${f.assessments.a}/respondents?unitId=${f.units.a2}`)).status()).toBe(403);

  // Tanpa penyaring unit, daftar responden hanya berisi unitnya sendiri.
  const roster = await api.get(`/api/assessments/${f.assessments.a}/respondents`);
  expect(roster.status()).toBe(200);
  const { respondents } = (await roster.json()) as { respondents: { unitId: string; fullName: string }[] };
  expect(respondents.map((r) => r.fullName).sort()).toEqual(["Responden Alfa Dua", "Responden Alfa Satu"]);
  expect(respondents.every((r) => r.unitId === f.units.a1)).toBe(true);
});

test("SUPER_ADMIN tidak dapat membuka daftar responden", async () => {
  const api = contexts.superAdmin.request;
  // SUPER_ADMIN tetap dapat melihat ringkasan asesmen, tetapi tidak daftar responden (docs/04 bagian 2).
  expect((await api.get(`/api/assessments/${f.assessments.a}`)).status()).toBe(200);
  const roster = await api.get(`/api/assessments/${f.assessments.a}/respondents`);
  expect(roster.status()).toBe(403);
  expect(await roster.json()).toEqual({ error: "FORBIDDEN" });

  // Pembanding: administrator klien organisasi A berhak membuka daftar responden asesmennya.
  const allowed = await contexts.adminA.request.get(`/api/assessments/${f.assessments.a}/respondents`);
  expect(allowed.status()).toBe(200);
  expect((await allowed.json()).respondents).toHaveLength(3);
});

test("permintaan tanpa sesi ditolak dengan 401", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL });
  expect((await anonymous.get(`/api/assessments/${f.assessments.a}`)).status()).toBe(401);
  await anonymous.dispose();
});
