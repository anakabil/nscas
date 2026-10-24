// Fase 6: survei responden di telepon genggam (docs/01 M3, docs/05 bagian 3). Cara memeriksa: buka tautan
// survei di telepon genggam, isi sampai selesai, coba mode pesawat di tengah pengisian.

import { expect, test, type Page } from "@playwright/test";
import { fixtures, type Fixtures } from "./helpers";

test.use({ viewport: { width: 360, height: 780 } });

let f: Fixtures;
test.beforeAll(() => {
  f = fixtures();
});

function token(project: string, purpose: string): string {
  return f.surveyTokens[`${project}:${purpose}`] as string;
}

async function start(page: Page, raw: string) {
  await page.goto(`/s/${raw}`);
  // Tombol bahasa di isi halaman; tombol ganti bahasa di kepala halaman berada di luar <main>.
  await page.getByRole("main").getByRole("button", { name: "Bahasa Indonesia" }).click();
  await expect(page.getByTestId("survey-consent")).toContainText("PT Gamma Karya");
  await page.getByRole("button", { name: "Saya setuju dan mulai survei" }).click();
}

const next = (page: Page) => page.getByRole("button", { name: "Lanjut", exact: true });

async function answerCharacteristic(page: Page, n: number) {
  const screen = page.getByTestId("survey-characteristic");
  await expect(page.getByTestId("survey-question")).toHaveText(`Bagian A · Pertanyaan ${n} dari 18`);
  await expect(next(page)).toBeDisabled();
  // Lima pernyataan tanpa nomor tingkat, ditambah Tidak tahu.
  const cards = screen.locator("label.survey-card");
  await expect(cards).toHaveCount(6);
  for (const text of await cards.allTextContents()) expect(text).not.toMatch(/^\s*\d|Tingkat/);
  if (n % 6 === 0) await screen.getByText("Tidak tahu", { exact: true }).click();
  else await cards.nth(n % 5).click();
  await next(page).click();
}

async function answerClimate(page: Page, screenNumber: number) {
  const screen = page.getByTestId("survey-climate");
  await expect(screen).toContainText(`Layar ${screenNumber} dari 7`);
  const items = screen.getByTestId("survey-climate-item");
  const count = await items.count();
  const labels = ["Setuju", "Sangat setuju", "Ragu-ragu", "Tidak setuju"];
  for (let i = 0; i < count; i++) await items.nth(i).getByText(labels[(i + screenNumber) % labels.length] as string, { exact: true }).click();
  await next(page).click();
}

test("responden mengisi survei di layar 360 piksel, sambungan terputus di tengah, lalu terkirim otomatis dan token tidak dapat dipakai lagi", async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  const raw = token(testInfo.project.name, "main");
  const response = await page.goto(`/s/${raw}`);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["cache-control"] ?? "").toContain("no-store");
  await start(page, raw);
  await expect(page.getByText("Bagian A berisi 18 pertanyaan.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Mulai" }).click();

  for (let n = 1; n <= 6; n++) await answerCharacteristic(page, n);

  // Draf tersimpan di perangkat: muat ulang halaman melanjutkan dari pertanyaan 7.
  await page.reload();
  await expect(page.getByTestId("survey-question")).toHaveText("Bagian A · Pertanyaan 7 dari 18");
  await page.getByRole("button", { name: "Kembali" }).click();
  await expect(page.getByTestId("survey-characteristic").locator("label.survey-card:has(input:checked)")).toHaveCount(1);
  await next(page).click();

  // Sambungan terputus di tengah pengisian: pengisian tetap berjalan.
  await context.setOffline(true);
  await expect(page.getByTestId("survey-offline")).toBeVisible();
  for (let n = 7; n <= 18; n++) await answerCharacteristic(page, n);
  for (let s = 1; s <= 7; s++) await answerClimate(page, s);

  await expect(page.getByTestId("survey-review")).toBeVisible();
  await page.getByTestId("survey-submit").click();
  await expect(page.getByTestId("survey-waiting")).toBeVisible();

  // Sambungan kembali: jawaban dikirim otomatis.
  await context.setOffline(false);
  await expect(page.getByTestId("survey-done")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("survey-done")).toContainText("paling sedikit lima orang");

  // Token tidak dapat dipakai lagi.
  await page.goto(`/s/${raw}`);
  await expect(page.getByTestId("survey-status")).toHaveAttribute("data-state", "USED");
  const again = await page.request.post(`/s/${raw}/submit`, {
    data: { language: "id", stratumId: null, durationSeconds: 600, characteristics: [{ characteristicId: "x", statementId: null }], climate: [{ itemId: "y", value: 3 }] },
  });
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: "ALREADY_SUBMITTED" });
});

test("muatan halaman survei di bawah 350 KB terkompresi", async ({ page }, testInfo) => {
  let bytes = 0;
  page.on("requestfinished", async (request) => {
    const sizes = await request.sizes().catch(() => null);
    if (sizes) bytes += sizes.responseBodySize + sizes.responseHeadersSize;
  });
  await page.goto(`/s/${token(testInfo.project.name, "payload")}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("main").getByRole("button", { name: "Bahasa Indonesia" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  testInfo.annotations.push({ type: "payload", description: `${(bytes / 1024).toFixed(1)} KB` });
  console.info(`Muatan halaman survei (${testInfo.project.name}): ${(bytes / 1024).toFixed(1)} KB`);
  expect(bytes).toBeGreaterThan(10 * 1024);
  expect(bytes).toBeLessThan(350 * 1024);
});

test("menolak persetujuan berarti tidak ada data yang dikirim", async ({ page }, testInfo) => {
  const submissions: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/submit")) submissions.push(r.url());
  });
  await page.goto(`/s/${token(testInfo.project.name, "decline")}`);
  await page.getByRole("main").getByRole("button", { name: "English" }).click();
  await expect(page.getByTestId("survey-consent")).toContainText("PT Gamma Karya and Nusa Safety");
  await page.getByRole("button", { name: "I do not agree" }).click();
  await expect(page.getByTestId("survey-declined")).toContainText("No answers have been stored.");
  expect(submissions).toEqual([]);
  await page.getByRole("button", { name: "Back to consent" }).click();
  await expect(page.getByTestId("survey-consent")).toBeVisible();
});

test("token kode QR meminta responden memilih kelompok jabatan dari daftar tertutup", async ({ page }, testInfo) => {
  await start(page, token(testInfo.project.name, "qr"));
  await expect(page.getByText("Kelompok jabatan Anda")).toBeVisible();
  await expect(page.getByText("Pekerja penyedia jasa dan subkontraktor")).toBeVisible();
  await expect(next(page)).toBeDisabled();
  await page.getByText("Pekerja penyedia jasa dan subkontraktor").click();
  await next(page).click();
  await expect(page.getByRole("button", { name: "Mulai" })).toBeVisible();
});

test("tautan yang dicabut atau tidak dikenal tidak dapat dipakai", async ({ page }) => {
  await page.goto(`/s/${f.surveyTokens.revoked}`);
  await expect(page.getByTestId("survey-status")).toHaveAttribute("data-state", "INVALID");
  await expect(page.getByText("Tautan tidak berlaku")).toBeVisible();
  await page.goto("/s/bukan-token");
  await expect(page.getByTestId("survey-status")).toHaveAttribute("data-state", "INVALID");
});
