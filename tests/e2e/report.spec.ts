// Fase 13: pelaporan (docs/01 M11). Asesor utama menyusun versi laporan (tiga dokumen), memeriksa pratinjau HTML,
// menunggu PDF dirender worker pg-boss dengan Chromium, lalu memfinalisasi dengan tanda tangan. Draf tidak terlihat
// oleh klien; versi final terlihat dan terkunci.

import { spawn, type ChildProcess } from "node:child_process";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { e2eDatabaseUrl } from "./database-url";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

const STANDING = "Hasil ini merupakan pengukuran dan diagnosis internal yang menggunakan kerangka Safety Culture Ladder sebagai rujukan, dan bukan sertifikat maupun pernyataan resmi Safety Culture Ladder yang diterbitkan lembaga sertifikasi yang diakui NEN.";

let f: Fixtures;
let lead: BrowserContext;
let worker: ChildProcess | null = null;

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  lead = await browser.newContext();
  await login(await lead.newPage(), "leadReport");
});

test.afterAll(async () => {
  worker?.kill("SIGTERM");
  await lead.close();
});

async function pdfStates(page: Page): Promise<string[]> {
  await page.reload();
  return page.getByTestId("report-version").first().getByTestId("report-document").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-pdf") ?? ""));
}

test("versi laporan: tiga dokumen, pratinjau HTML dengan pernyataan kedudukan hasil, dan PDF dari worker", async ({ baseURL }) => {
  test.setTimeout(180_000);
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.report}/report`);
  await expect(page.getByTestId("standing-statement")).toHaveText(STANDING);
  await page.getByRole("button", { name: "Susun versi laporan baru" }).click();
  await expect(page.getByTestId("report-created")).toHaveText("Versi 1 disusun. PDF sedang disiapkan.");
  const version = page.getByTestId("report-version");
  await expect(version).toHaveCount(1);
  await expect(version).toHaveAttribute("data-status", "DRAFT");
  await expect(version.getByTestId("report-document")).toHaveCount(3);

  for (const [kind, title] of [
    ["FULL", "Laporan Asesmen Budaya Keselamatan dan Kesehatan Kerja"],
    ["EXECUTIVE_SUMMARY", "Ringkasan Eksekutif Asesmen Budaya Keselamatan dan Kesehatan Kerja"],
    ["STATEMENT", "Pernyataan Hasil Pengukuran Budaya Keselamatan dan Kesehatan Kerja"],
  ]) {
    const href = (await version.locator(`[data-kind="${kind}"]`).getByTestId("report-preview").getAttribute("href")) as string;
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
    const html = await response.text();
    expect(html).toContain(title);
    expect(html).toContain(STANDING);
    expect(html).toContain('data-status="DRAFT"');
  }
  // Laporan lengkap memuat lampiran narasumber dan bukti; logo dan huruf termuat di bawah CSP aplikasi.
  const preview = await lead.newPage();
  await preview.goto((await version.locator('[data-kind="FULL"]').getByTestId("report-preview").getAttribute("href")) as string);
  await expect(preview.getByText("Hendra Gunawan, Manajer Proyek")).toBeVisible();
  await expect(preview.getByText("Prosedur pelaporan hampir celaka")).toBeVisible();
  await expect.poll(() => preview.locator("img.logo").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  // Worker pg-boss merender ketiga PDF dengan Chromium.
  worker = spawn(process.execPath, ["--conditions=react-server", "--env-file-if-exists=.env", "--import", "tsx", "src/worker.ts"], {
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl(), APP_URL: baseURL, PDF_CHROMIUM_EXECUTABLE: process.env.PDF_CHROMIUM_EXECUTABLE || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "" },
    stdio: "ignore",
  });
  await expect.poll(() => pdfStates(page), { timeout: 120_000, intervals: [3_000] }).toEqual(["READY", "READY", "READY"]);
  const pdfHref = (await page.getByTestId("report-version").first().locator('[data-kind="STATEMENT"]').getByTestId("report-pdf").getAttribute("href")) as string;
  const redirect = await page.request.get(pdfHref, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  const pdf = await page.request.get(redirect.headers().location as string);
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("draf tidak terlihat oleh pimpinan eksekutif", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "executiveC");
  await page.goto(`/assessments/${f.assessments.report}/report`);
  await expect(page.getByTestId("standing-statement")).toBeVisible();
  await expect(page.getByTestId("report-version")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Susun versi laporan baru" })).toHaveCount(0);
  await context.close();
});

test("finalisasi dengan tanda tangan lead assessor mengunci versi; klien melihat versi final", async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.report}/report`);
  const version = page.getByTestId("report-version").first();
  await expect(version.getByRole("button", { name: "Finalisasi dan tandatangani versi 1" })).toBeDisabled();
  await version.getByLabel("Saya telah memeriksa isi laporan dan menyetujuinya sebagai versi final.").check();
  await version.getByRole("button", { name: "Finalisasi dan tandatangani versi 1" }).click();
  await expect(version.getByText("Isi jabatan penanda tangan.")).toBeVisible();
  await version.getByLabel("Jabatan penanda tangan").fill("Lead Assessor Nusa Safety");
  await version.getByRole("button", { name: "Finalisasi dan tandatangani versi 1" }).click();
  await expect(page.getByTestId("report-version").first()).toHaveAttribute("data-status", "FINAL");
  await expect(page.getByTestId("report-signed")).toContainText("Ditandatangani leadReport, Lead Assessor Nusa Safety");
  await expect(page.getByTestId("finalize-form")).toHaveCount(0);

  const href = (await page.getByTestId("report-version").first().locator('[data-kind="STATEMENT"]').getByTestId("report-preview").getAttribute("href")) as string;
  const html = await (await page.request.get(href)).text();
  expect(html).toContain('data-status="FINAL"');
  expect(html).toContain("Ditandatangani secara elektronik");
  expect(html).toContain("leadReport, Lead Assessor Nusa Safety");
  expect(html).not.toContain('class="watermark"');
  await expect.poll(() => pdfStates(page), { timeout: 120_000, intervals: [3_000] }).toEqual(["READY", "READY", "READY"]);
  worker?.kill("SIGTERM");
  worker = null;

  // Laporan final yang ditandatangani memenuhi syarat perubahan status ke Dilaporkan.
  await page.goto(`/assessments/${f.assessments.report}`);
  await expect(page.getByRole("button", { name: "Ubah status menjadi Dilaporkan" })).toBeVisible();

  const context = await browser.newContext();
  const client = await context.newPage();
  await login(client, "executiveC");
  await client.goto(`/assessments/${f.assessments.report}/report`);
  await expect(client.getByTestId("report-version")).toHaveCount(1);
  await expect(client.getByTestId("report-version")).toHaveAttribute("data-status", "FINAL");
  await expect(client.getByTestId("report-pdf")).toHaveCount(3);
  await context.close();
});
