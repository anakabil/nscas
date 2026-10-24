// Fase 11: dasbor (docs/01 M9). Peta warna dan ekspor tidak menampilkan titik data dari kurang dari 5 respons;
// pimpinan eksekutif hanya melihat ringkasan dan grafik setelah final; koordinator unit hanya unitnya; asesor
// mengeluarkan dan memulihkan respons bertanda dengan alasan.

import ExcelJS from "exceljs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

let f: Fixtures;
let lead: BrowserContext;

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  lead = await browser.newContext();
  await login(await lead.newPage(), "leadDashboard");
});

test.afterAll(async () => {
  await lead.close();
});

async function visibleCountsAtLeastFive(page: Page) {
  const counts = await page.locator('[data-testid="heat-cell"][data-state="visible"]').evaluateAll((cells) => cells.map((c) => Number(c.getAttribute("data-n"))));
  expect(counts.length).toBeGreaterThan(0);
  expect(counts.every((n) => n >= 5)).toBe(true);
}

test("dasbor asesor: ringkasan, grafik, peta warna dengan sel tersembunyi, daftar, pembandingan, dan ekspor", async () => {
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.dashboard}/dashboard`);
  await expect(page.getByTestId("final-note")).toContainText("Hasil ditetapkan rapat panel pada");
  await expect(page.getByTestId("card-index")).toHaveText("3,14");
  await expect(page.getByTestId("card-priority")).toHaveText("A1");
  await expect(page.getByTestId("chart-aspects").locator(".recharts-bar-rectangle")).toHaveCount(6);
  await expect(page.getByTestId("chart-characteristics").locator(".recharts-bar-rectangle")).toHaveCount(18);

  // Strata: S1 (3 responden) disembunyikan; S2 ikut disembunyikan karena rata-rata manajemen diterbitkan.
  const strata = page.getByTestId("heatmap-strata");
  await expect(strata.locator('[data-state="suppressed"]')).toHaveCount(6);
  await expect(strata.locator('[data-state="secondary"]')).toHaveCount(6);
  await expect(strata.locator('[data-state="visible"]')).toHaveCount(6);
  await expect(strata.locator('[data-state="suppressed"]').first()).toHaveText("Disembunyikan");
  // Unit: Proyek Dasbor Selatan (2 responden) disembunyikan.
  const units = page.getByTestId("heatmap-units");
  await expect(units.locator("thead th")).toHaveText(["Aspek", "Proyek Dasbor Selatan", "Proyek Dasbor Utara"]);
  await expect(units.locator('[data-state="suppressed"]')).toHaveCount(6);
  await visibleCountsAtLeastFive(page);
  await expect(page.getByText("3 responden")).toHaveCount(0);
  await expect(page.getByText("2 responden")).toHaveCount(0);

  await expect(page.getByTestId("divergence-row").filter({ hasText: "K1.3" })).toBeVisible();
  await expect(page.getByTestId("gap-row")).toHaveCount(6);
  await expect(page.getByTestId("comparison-row")).toContainText("Asesmen Dasbor Gamma 2025");
  await expect(page.getByTestId("chart-comparison").locator(".recharts-bar-rectangle")).toHaveCount(12);

  const href = (await page.getByTestId("dashboard-export").getAttribute("href")) as string;
  const download = await page.request.get(href);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toContain("spreadsheetml");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await download.body()) as never);
  for (const name of ["Peta strata", "Peta unit"]) {
    workbook.getWorksheet(name)?.eachRow((row, i) => {
      if (i === 1) return;
      const n = row.getCell(4).value;
      if (row.getCell(3).value === null) expect(n).toBeNull();
      else expect(n as number).toBeGreaterThanOrEqual(5);
    });
  }
});

test("panel mutu data: asesor mengeluarkan dan memulihkan respons bertanda dengan alasan", async () => {
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/dashboard`);
  await expect(page.getByTestId("dashboard-unavailable")).toHaveText("Belum ada hasil. Hasil tersedia setelah mesin penilaian dijalankan.");
  await page.goto(`/assessments/${f.assessments.survey}/dashboard/quality`);
  await expect(page.getByTestId("quality-alpha")).toBeVisible();
  const code = (f.flaggedResponses[1] as string).slice(0, 8);
  const row = page.getByTestId("flagged-row").and(page.locator(`[data-code="${code}"]`));
  await expect(row).toContainText("Terlalu cepat");
  await expect(row).toContainText("Banyak tidak tahu");
  await expect(row).toContainText("di bawah 5 menit");

  await row.getByLabel(`Alasan untuk respons ${code}`).fill("Singkat");
  await row.getByRole("button", { name: "Keluarkan" }).click();
  await expect(row.getByRole("alert")).toHaveText("Alasan wajib diisi, paling sedikit 10 karakter.");
  await row.getByLabel(`Alasan untuk respons ${code}`).fill("Durasi kurang dari 5 menit dan sebagian besar tidak tahu.");
  await row.getByRole("button", { name: "Keluarkan" }).click();
  await expect(row).toHaveAttribute("data-excluded", "true");
  await expect(row).toContainText("Durasi kurang dari 5 menit dan sebagian besar tidak tahu.");

  await row.getByLabel(`Alasan untuk respons ${code}`).fill("Ditinjau ulang bersama asesor kedua.");
  await row.getByRole("button", { name: "Pulihkan" }).click();
  await expect(row).toHaveAttribute("data-excluded", "false");
});

test("pimpinan eksekutif hanya melihat ringkasan dan grafik setelah hasil final", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "executiveC");
  await page.goto(`/assessments/${f.assessments.dashboard}/dashboard`);
  await expect(page.getByTestId("summary-cards")).toBeVisible();
  await expect(page.getByTestId("chart-aspects")).toBeVisible();
  await expect(page.getByTestId("chart-comparison")).toBeVisible();
  await expect(page.getByTestId("heatmap-strata")).toHaveCount(0);
  await expect(page.getByTestId("heatmap-units")).toHaveCount(0);
  await expect(page.getByTestId("gap-table")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-export")).toHaveCount(0);
  expect((await page.request.get(`/api/assessments/${f.assessments.dashboard}/dashboard/export`)).status()).toBe(403);
  await page.goto(`/assessments/${f.assessments.dashboard}/dashboard/quality`);
  await expect(page).toHaveURL(/\/forbidden$/);

  await page.goto(`/assessments/${f.assessments.survey}/dashboard`);
  await expect(page.getByTestId("dashboard-unavailable")).toHaveText("Hasil tersedia setelah ditetapkan rapat panel.");
  await context.close();
});

test("koordinator unit hanya melihat unitnya; sel unit dengan 2 responden tetap disembunyikan", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "coordinatorDashboard");
  await page.goto(`/assessments/${f.assessments.dashboard}/dashboard`);
  await expect(page.getByTestId("heatmap-strata")).toHaveCount(0);
  const units = page.getByTestId("heatmap-units");
  await expect(units.locator("thead th")).toHaveText(["Aspek", "Proyek Dasbor Selatan"]);
  await expect(units.locator('[data-state="visible"]')).toHaveCount(0);
  await expect(units.locator('[data-state="suppressed"]')).toHaveCount(6);
  await context.close();
});
