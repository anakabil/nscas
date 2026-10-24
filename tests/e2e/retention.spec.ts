// Fase 14: retensi dan jejak audit (docs/04 bagian 6 dan 7). SUPER_ADMIN memusnahkan data mentah asesmen
// diarsipkan yang masa simpannya habis, worker merender berita acara PDF, lead assessor mengekspor jejak audit
// ke CSV, dan administrator klien hanya melihat ringkasan tanpa isi perubahan.

import { spawn, type ChildProcess } from "node:child_process";
import { expect, test, type BrowserContext } from "@playwright/test";
import { e2eDatabaseUrl } from "./database-url";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

let f: Fixtures;
let admin: BrowserContext;
let worker: ChildProcess | null = null;

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  admin = await browser.newContext();
  await login(await admin.newPage(), "superRetention");
});

test.afterAll(async () => {
  worker?.kill("SIGTERM");
  await admin.close();
});

test("SUPER_ADMIN memusnahkan data mentah setelah konfirmasi klien, lalu berita acara PDF tersedia", async ({ baseURL }) => {
  test.setTimeout(180_000);
  const page = await admin.newPage();
  await page.goto("/assessments");
  await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Retensi data" }).click();
  await expect(page).toHaveURL(/\/retention$/);
  const row = page.locator(`[data-testid="retention-row"][data-assessment="${f.assessments.archive}"]`);
  await expect(row.getByTestId("retention-state")).toHaveText("Masa simpan habis");
  await expect(row.getByTestId("retention-end")).toHaveText("15 November 2025");

  const form = row.getByTestId("destruction-form");
  const submit = form.getByRole("button", { name: "Musnahkan data mentah" });
  await expect(submit).toBeDisabled();
  await form.getByLabel("Nomor surat konfirmasi klien").fill("012/HSE-GK/X/2026");
  await form.getByLabel("Tanggal surat").fill("2026-10-20");
  await form.getByLabel("Penanda tangan surat (nama dan jabatan)").fill("Direktur Operasi PT Gamma Karya");
  // Tanpa saksi ditolak di server dengan pesan yang jelas.
  await form.getByLabel("Saya memahami pemusnahan tidak dapat dibatalkan.").check();
  await submit.click();
  await expect(form.locator('[data-slot="alert"]')).toHaveText("Lengkapi nomor dan tanggal surat konfirmasi klien, penanda tangannya, dan nama saksi.");
  await form.getByLabel("Nama saksi").fill("Rina Kusuma");
  await submit.click();

  await expect(row.getByTestId("retention-state")).toHaveText(/^Dimusnahkan /);
  await expect(row.getByTestId("destruction-minutes-pending")).toBeVisible();
  await expect(row.getByTestId("destruction-form")).toHaveCount(0);

  worker = spawn(process.execPath, ["--conditions=react-server", "--env-file-if-exists=.env", "--import", "tsx", "src/worker.ts"], {
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl(), APP_URL: baseURL, PDF_CHROMIUM_EXECUTABLE: process.env.PDF_CHROMIUM_EXECUTABLE || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "" },
    stdio: "ignore",
  });
  await expect
    .poll(
      async () => {
        await page.reload();
        return row.getByTestId("destruction-minutes").count();
      },
      { timeout: 120_000, intervals: [3_000] },
    )
    .toBe(1);
  const href = (await row.getByTestId("destruction-minutes").getAttribute("href")) as string;
  const redirect = await page.request.get(href, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  const pdf = await page.request.get(redirect.headers().location as string);
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("lead assessor melihat jejak audit lengkap dan mengekspor CSV", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "leadArchive");
  await page.goto(`/assessments/${f.assessments.archive}`);
  await page.getByRole("link", { name: "Jejak audit" }).click();
  await expect(page).toHaveURL(new RegExp(`/assessments/${f.assessments.archive}/audit$`));
  await expect(page.locator('[data-testid="audit-entry"][data-action="retention.destroy"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="audit-entry"][data-action="retention.minutes"]')).toHaveCount(1);
  await expect(page.getByTestId("audit-change").first()).toBeVisible();

  const response = await page.request.get((await page.getByTestId("audit-export").getAttribute("href")) as string);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  const csv = (await response.body()).toString("utf8");
  expect(csv.startsWith("﻿waktu_utc;waktu_wib;aksi;jenis_entitas;")).toBe(true);
  expect(csv).toContain("retention.destroy");
  // Nilai JSON yang memuat rumus berada di dalam sel berkutip; tidak ada sel yang diawali tanda sama dengan.
  expect(csv).not.toMatch(/(^|;)=/m);

  // Ekspor itu sendiri tercatat di jejak audit.
  await page.reload();
  await expect(page.locator('[data-testid="audit-entry"][data-action="audit.export"]')).toHaveCount(1);
  // Lead assessor bukan SUPER_ADMIN: halaman retensi ditolak.
  await page.goto("/retention");
  await expect(page).toHaveURL(/\/forbidden$/);
  await context.close();
});

test("administrator klien melihat ringkasan jejak audit tanpa isi perubahan dan tanpa ekspor", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "adminArchive");
  await page.goto(`/assessments/${f.assessments.archive}/audit`);
  await expect(page.locator('[data-testid="audit-entry"][data-action="retention.destroy"]')).toHaveCount(1);
  await expect(page.getByTestId("audit-change")).toHaveCount(0);
  await expect(page.getByTestId("audit-export")).toHaveCount(0);
  const response = await page.request.get(`/api/assessments/${f.assessments.archive}/audit/export`);
  expect(response.status()).toBe(403);
  await context.close();
});
