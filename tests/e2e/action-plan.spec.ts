// Fase 12: daftar kesenjangan dan rencana aksi (docs/01 M10). Asesor utama membentuk daftar dari hasil final,
// tim mengisi analisis dan tindakan, koordinator unit memperbarui kemajuan tindakan unitnya, asesor memverifikasi,
// lalu pemantauan triwulanan dan ekspor Excel.

import ExcelJS from "exceljs";
import { expect, test, type BrowserContext } from "@playwright/test";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

let f: Fixtures;
let lead: BrowserContext;
let coordinator: BrowserContext;

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  lead = await browser.newContext();
  coordinator = await browser.newContext();
  await login(await lead.newPage(), "leadPlan");
  await login(await coordinator.newPage(), "coordinatorPlan");
});

test.afterAll(async () => {
  await Promise.all([lead.close(), coordinator.close()]);
});

test("asesor utama membentuk daftar kesenjangan, mengisi analisis, dan menambah tindakan", async () => {
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.plan}/gaps`);
  await page.getByRole("button", { name: "Bentuk daftar kesenjangan" }).click();
  await expect(page.getByTestId("gaps-generated")).toHaveText("18 butir kesenjangan dibentuk.");
  await expect(page.getByTestId("gap-item")).toHaveCount(18);
  const top = page.getByTestId("gap-item").first();
  await expect(top).toHaveAttribute("data-code", "K1.3");
  await expect(top).toContainText("Peringkat 1");
  await expect(top.getByTestId("gap-value")).toHaveText("2,00");

  await top.getByLabel("Analisis penyebab").fill("Pekerja khawatir laporan berujung sanksi, sehingga pelaporan rendah.");
  await top.getByLabel("Prioritas").selectOption({ label: "Tinggi" });
  await top.getByRole("button", { name: "Simpan analisis" }).click();
  await expect(top.getByTestId("analysis-saved")).toBeVisible();

  await top.getByTestId("add-action").locator("summary").click();
  const form = top.getByTestId("add-action").getByTestId("action-form");
  await form.getByLabel("Tindakan", { exact: true }).fill("Pelatihan pelaporan hampir celaka");
  await form.getByLabel("Nama penanggung jawab").fill("Rina Wulandari");
  await form.getByLabel("Jabatan penanggung jawab").fill("Manajer K3 proyek");
  await form.getByLabel("Surel penanggung jawab (untuk pengingat tenggat)").fill("rina@e2e.test");
  await form.getByLabel("Unit pelaksana").selectOption({ label: "Proyek Rencana Utara" });
  await form.getByLabel("Tenggat", { exact: true }).fill("2027-03-31");
  await form.getByLabel("Indikator keberhasilan").fill("90 persen pekerja proyek terlatih");
  await form.getByRole("button", { name: "Simpan tindakan" }).click();
  await expect(form.getByTestId("action-saved")).toHaveText("Tindakan ditambahkan.");
  await expect(top.getByTestId("action-item")).toHaveCount(1);
  await expect(top.getByTestId("action-status")).toHaveText("Direncanakan");

  // Penerbitan ditolak sebelum setiap butir lengkap.
  await page.getByRole("button", { name: "Terbitkan rencana aksi ke klien" }).click();
  await expect(page.getByText("Rencana aksi belum lengkap.", { exact: false })).toBeVisible();
  await expect(page.getByText("Belum lengkap: K", { exact: false })).toBeVisible();
});

test("koordinator unit memperbarui kemajuan tindakan unitnya; asesor memverifikasi", async () => {
  const page = await coordinator.newPage();
  await page.goto(`/assessments/${f.assessments.plan}/gaps`);
  const top = page.getByTestId("gap-item").first();
  // Koordinator unit tidak mengisi analisis penyebab; tindakan baru hanya untuk unitnya.
  await expect(top.getByRole("button", { name: "Simpan analisis" })).toHaveCount(0);
  await top.getByTestId("add-action").locator("summary").click();
  await expect(top.getByTestId("add-action").getByLabel("Unit pelaksana").locator("option")).toHaveText(["Proyek Rencana Utara"]);

  const item = top.getByTestId("action-item");
  await item.locator("summary", { hasText: "Pembaruan kemajuan" }).click();
  await item.getByLabel("Catatan kemajuan").fill("Pelatihan selesai untuk seluruh pekerja proyek.");
  await item.getByLabel("Kemajuan (persen)").fill("100");
  await item.getByLabel("Status setelah pembaruan").selectOption({ label: "Selesai, menunggu verifikasi" });
  await item.getByRole("button", { name: "Simpan pembaruan" }).click();
  await expect(item.getByTestId("progress-saved")).toBeVisible();
  await expect(item).toHaveAttribute("data-status", "DONE");
  await expect(item.getByTestId("action-progress")).toHaveText("100%");

  const leadPage = await lead.newPage();
  await leadPage.goto(`/assessments/${f.assessments.plan}/gaps`);
  const leadItem = leadPage.getByTestId("gap-item").first().getByTestId("action-item");
  await leadItem.getByLabel("Catatan verifikasi").fill("Daftar hadir dan materi pelatihan sesuai indikator.");
  await leadItem.getByRole("button", { name: "Setujui" }).click();
  await expect(leadItem).toHaveAttribute("data-status", "VERIFIED");
  await expect(leadItem).toContainText("Diverifikasi leadPlan");
  await expect(leadItem.locator("summary", { hasText: "Ubah tindakan" })).toHaveCount(0);
  await leadItem.locator("summary", { hasText: "Riwayat pembaruan" }).click();
  await expect(leadItem.getByTestId("action-history").locator("li")).toHaveCount(2);
});

test("pemantauan triwulanan dan ekspor Excel", async () => {
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.plan}/gaps/monitoring`);
  const quarter = page.getByTestId("quarter").filter({ hasText: "Triwulan 1 tahun 2027" });
  await expect(quarter.getByTestId("quarter-counts")).toContainText("1 tindakan: 1 terverifikasi");
  await expect(quarter.getByTestId("monitoring-row")).toContainText(["K1.3"]);

  await page.goto(`/assessments/${f.assessments.plan}/gaps`);
  const response = await page.request.get((await page.getByTestId("gaps-export").getAttribute("href")) as string);
  expect(response.status()).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await response.body()) as never);
  expect(workbook.worksheets.map((w) => w.name)).toEqual(["Daftar kesenjangan", "Rencana aksi", "Riwayat pembaruan"]);
  expect(workbook.getWorksheet("Daftar kesenjangan")?.getRow(2).getCell(2).value).toBe("K1.3");
  expect(workbook.getWorksheet("Rencana aksi")?.getRow(2).getCell(9).value).toBe("Terverifikasi");
});

test("pimpinan eksekutif hanya membaca rencana aksi", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "executiveC");
  await page.goto(`/assessments/${f.assessments.plan}/gaps`);
  await expect(page.getByTestId("gap-item")).toHaveCount(18);
  await expect(page.getByTestId("add-action")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Simpan analisis" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bentuk daftar kesenjangan" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Perbarui daftar dari hasil final" })).toHaveCount(0);
  await context.close();
});
