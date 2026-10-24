// Fase 9: validasi daring (docs/01 M7). Lead assessor membuat sesi dari usulan kalkulator sampel, menjadwalkannya
// dengan tautan rapat, dan mengubah panduan pertanyaan; asesor mengisi formulir per sesi dan daftar narasumber.

import { expect, test, type BrowserContext } from "@playwright/test";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

let f: Fixtures;
let lead: BrowserContext;
let assessor: BrowserContext;

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  lead = await browser.newContext();
  assessor = await browser.newContext();
  await login(await lead.newPage(), "leadValidation");
  await login(await assessor.newPage(), "assessorValidation");
});

test.afterAll(async () => {
  await Promise.all([lead.close(), assessor.close()]);
});

test("usulan sesi dari kalkulator sampel dibuat sekali, lalu dijadwalkan dengan tautan rapat", async () => {
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/validation`);
  const row = (code: string) => page.getByTestId("proposal-row").and(page.locator(`[data-code="${code}"]`));
  // 15 wawancara untuk strata manajemen dan penyelia; 29 peserta diskusi kelompok, paling banyak 8 per sesi.
  await expect(row("S2").getByTestId("proposal-interviews")).toHaveText("4");
  await expect(row("S3").getByTestId("proposal-interviews")).toHaveText("11");
  await expect(row("S3").getByTestId("proposal-fg-sessions")).toHaveText("1");
  await expect(row("S4").getByTestId("proposal-fg-sessions")).toHaveText("2");
  await expect(row("S5").getByTestId("proposal-fg-sessions")).toHaveText("2");
  await expect(row("S4").getByTestId("proposal-interviews")).toHaveText("0");
  await expect(page.getByTestId("proposal-total")).toHaveAttribute("data-count", "21");

  await page.getByRole("button", { name: "Buat sesi dari usulan" }).click();
  await expect(page.getByTestId("proposal-created")).toContainText("21 sesi dibuat");
  await page.reload();
  await expect(page.getByTestId("session-row")).toHaveCount(21);
  await expect(page.locator('[data-testid="session-row"][data-type="FOCUS_GROUP"]')).toHaveCount(5);
  await expect(page.locator('[data-testid="session-row"][data-type="VIRTUAL_SITE_VISIT"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Buat sesi dari usulan" })).toHaveCount(0);

  await page.getByRole("link", { name: "Diskusi kelompok S4 nomor 1" }).click();
  await expect(page.getByTestId("session-label")).toHaveText("Diskusi kelompok S4 nomor 1");
  await page.getByLabel("Waktu (WIB)").fill("2026-11-12T09:30");
  await page.getByLabel("Tautan rapat").fill("https://meet.google.com/abc-defg-hij");
  await page.getByRole("button", { name: "Simpan jadwal" }).click();
  await expect(page.getByText("Jadwal tersimpan.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Buka rapat" })).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
  await expect(page.getByText("12 November 2026, 09.30 WIB", { exact: false }).first()).toBeVisible();

  // Panduan lapangan memuat pertanyaan validasi K5.1 sesuai ketentuan.
  await expect(page.getByTestId("session-guide")).toContainText("Ceritakan laporan terakhir yang Anda buat atau terima. Apa tindak lanjutnya, dan berapa lama?");
});

test("lead assessor mengubah panduan pertanyaan; asesor hanya dapat membacanya", async () => {
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/validation/guides`);
  const field = page.getByTestId("guide-FIELD");
  await field.locator("#q-FIELD-K5\\.1").fill("Ceritakan laporan terakhir yang Anda buat atau terima di proyek ini. Apa tindak lanjutnya, dan berapa lama?");
  await field.getByRole("button", { name: "Simpan panduan Lapangan" }).click();
  await expect(field.getByText("Panduan tersimpan.")).toBeVisible();

  const other = await assessor.newPage();
  await other.goto(`/assessments/${f.assessments.survey}/validation/guides`);
  await expect(other.getByText("Hanya lead assessor yang dapat mengubah panduan.").first()).toBeVisible();
  await expect(other.locator("#q-FIELD-K5\\.1")).toHaveValue(/di proyek ini/);
  await expect(other.getByRole("button", { name: "Simpan panduan Lapangan" })).toHaveCount(0);
});

test("asesor mengisi nilai kelipatan 0,5 dan narasumber terpisah; nilai asesor lain tidak terlihat", async () => {
  const page = await assessor.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/validation`);
  await page.getByRole("link", { name: "Diskusi kelompok S4 nomor 1" }).click();
  // Asesor tidak dapat mengubah jadwal.
  await expect(page.getByRole("button", { name: "Simpan jadwal" })).toHaveCount(0);

  const level = page.getByLabel("Nilai K5.1", { exact: true });
  await expect(level.locator("option")).toHaveText(["Tidak dibahas", "1,0", "1,5", "2,0", "2,5", "3,0", "3,5", "4,0", "4,5", "5,0"]);
  await level.selectOption("3.5");
  await page.getByLabel("Catatan K5.1", { exact: true }).fill("Laporan ditindaklanjuti dalam dua hari.");
  await page.getByLabel("Narasumber menyetujui sesi direkam").check();
  await page.getByLabel("Catatan sesi").fill("Pekerja menyebut pelaporan hampir celaka melalui mandor.");
  await page.getByRole("button", { name: "Simpan formulir" }).click();
  await expect(page.getByTestId("assessor-form-saved")).toBeVisible();

  await page.getByLabel("Nama", { exact: true }).fill("Budi Santoso");
  await page.getByLabel("Jabatan").fill("Mandor");
  await page.getByRole("button", { name: "Tambah narasumber" }).click();
  await expect(page.getByTestId("participant-list")).toContainText("Budi Santoso");

  await page.reload();
  await expect(page.getByLabel("Nilai K5.1", { exact: true })).toHaveValue("3.5");
  await expect(page.getByLabel("Catatan sesi")).not.toHaveValue(/Budi Santoso/);

  // Lead assessor melihat jumlah nilai, tetapi formulirnya sendiri kosong.
  const leadPage = await lead.newPage();
  await leadPage.goto(`/assessments/${f.assessments.survey}/validation`);
  await leadPage.getByRole("link", { name: "Diskusi kelompok S4 nomor 1" }).click();
  await expect(leadPage.getByText("1 nilai tersimpan dari semua asesor")).toBeVisible();
  await expect(leadPage.getByLabel("Nilai K5.1", { exact: true })).toHaveValue("");
  await expect(leadPage.getByLabel("Catatan sesi")).toHaveValue("Pekerja menyebut pelaporan hampir celaka melalui mandor.");
});
