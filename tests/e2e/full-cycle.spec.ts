// Fase 15: satu siklus penuh asesmen melalui antarmuka, dari Draf sampai Dilaporkan (docs/01 bagian 3).
// Asesor utama mengonfigurasi dan mengunci, administrator klien mengimpor responden dan membagikan tautan,
// lima responden mengisi survei, dua asesor menilai bukti, mesin dijalankan, rapat panel menetapkan hasil,
// laporan ditandatangani, lalu status menjadi Dilaporkan. Setiap transisi tercatat di jejak audit.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

const CHARACTERISTICS = ["K1.1", "K1.2", "K1.3", "K2.1", "K2.2", "K3.1", "K3.2", "K3.3", "K4.1", "K4.2", "K4.3", "K5.1", "K5.2", "K5.3", "K6.1", "K6.2", "KT.1", "KT.2"];
const PROJECT = "Proyek Siklus Utara";

let lead: BrowserContext;
let assessor: BrowserContext;
let admin: BrowserContext;
let base = "";
let links: string[] = [];

/** Nilai isian datetime-local dalam WIB, dibulatkan ke bawah ke menit. */
function wibInput(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60_000 + 7 * 3_600_000).toISOString().slice(0, 16);
}

async function transition(page: Page, button: string, status: string) {
  await page.goto(base);
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByTestId("assessment-status")).toHaveText(status);
}

test.beforeAll(async ({ browser }) => {
  lead = await browser.newContext();
  assessor = await browser.newContext();
  admin = await browser.newContext();
  // Tiga pengguna berbeda: satu kode TOTP tidak dapat dipakai dua kali dalam 30 detik.
  await login(await lead.newPage(), "leadCycle");
  await login(await assessor.newPage(), "assessorCycle");
  await login(await admin.newPage(), "adminCycle");
});

test.afterAll(async () => {
  await Promise.all([lead.close(), assessor.close(), admin.close()]);
});

test("konfigurasi oleh asesor utama sampai dikunci", async () => {
  test.setTimeout(120_000);
  const page = await lead.newPage();
  await page.goto("/assessments/new");
  await page.getByLabel("Organisasi klien").selectOption({ label: "PT Siklus Konstruksi" });
  await page.getByLabel("Nama asesmen").fill("Asesmen Budaya K3 Siklus 2026");
  await page.getByLabel("Tanggal mulai").fill("2026-10-01");
  await page.getByLabel("Tanggal selesai").fill("2026-12-31");
  await page.getByRole("button", { name: "Buat asesmen" }).click();
  await expect(page).toHaveURL(/\/assessments\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  base = new URL(page.url()).pathname;
  await expect(page.getByTestId("assessment-status")).toHaveText("Draf");

  await page.goto(`${base}/setup/units`);
  await page.locator("#new-unit-name").fill("Kantor Pusat Siklus");
  await page.locator("#new-unit-type").selectOption("HEAD_OFFICE");
  await page.getByRole("button", { name: "Tambah unit" }).click();
  await expect(page.getByTestId("unit-tree")).toContainText("Kantor Pusat Siklus");
  await page.locator("#new-unit-name").fill(PROJECT);
  await page.locator("#new-unit-type").selectOption("PROJECT");
  await page.locator("#new-unit-parent").selectOption({ label: "Kantor Pusat Siklus" });
  await page.getByRole("button", { name: "Tambah unit" }).click();
  await expect(page.getByTestId("unit-summary")).toHaveText("2 unit, termasuk 1 proyek");

  await page.goto(`${base}/setup/strata`);
  for (const [code, population] of [["S1", "2"], ["S2", "5"], ["S3", "10"], ["S4", "30"], ["S5", "13"]]) await page.getByLabel(`Populasi ${code}`).fill(population);
  await page.getByRole("button", { name: "Simpan populasi" }).click();
  await expect(page.getByTestId("strata-total")).toHaveText("60");

  await page.goto(`${base}/setup/sampling`);
  await page.getByLabel("Jumlah proyek berjalan (N)").fill("1");
  await page.getByLabel("Jumlah lokasi (X)").fill("1");
  await page.getByRole("button", { name: "Simpan hasil kalkulator" }).click();
  await expect(page.getByTestId("sample-plan-saved")).toBeVisible();

  await page.goto(`${base}/setup/parameters`);
  await page.getByLabel("Perjanjian pemrosesan data dengan klien sudah ditandatangani").check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Perubahan berhasil disimpan.")).toBeVisible();

  await page.goto(`${base}/setup/team`);
  await page.getByLabel("Staf Nusa Safety").selectOption({ label: "assessorCycle (asesor.siklus@e2e.test)" });
  await page.getByRole("button", { name: "Tugaskan" }).click();
  await expect(page.getByTestId("team-table")).toContainText("asesor.siklus@e2e.test");

  await transition(page, "Ubah status menjadi Terkonfigurasi", "Terkonfigurasi");
  await transition(page, "Kunci konfigurasi", "Parameter dikunci");
});

test("administrator klien mengimpor responden, membuka survei, dan membagikan tautan", async () => {
  const page = await admin.newPage();
  await page.goto(`${base}/respondents`);
  await page.getByLabel("Dibuka").fill(wibInput(-24 * 60));
  await page.getByLabel("Ditutup").fill(wibInput(24 * 60));
  await page.getByRole("button", { name: "Simpan jendela survei" }).click();
  await expect(page.getByText("Perubahan berhasil disimpan.")).toBeVisible();

  const rows = Array.from({ length: 6 }, (_, i) => [`Pekerja Siklus ${i + 1}`, `SK-${i + 1}`, "", "", PROJECT, "S4", "Tidak"].join(";"));
  const csv = Buffer.from(`﻿${["Nama;Nomor induk;Surel;Telepon;Unit;Strata;Penyedia jasa", ...rows].join("\r\n")}\r\n`, "utf8");
  await page.getByLabel("Berkas daftar responden").setInputFiles({ name: "responden.csv", mimeType: "text/csv", buffer: csv });
  await page.getByRole("button", { name: "Periksa berkas" }).click();
  await expect(page.getByTestId("preview-valid")).toHaveAttribute("data-value", "6");
  await page.getByRole("button", { name: "Simpan 6 responden" }).click();
  await expect(page.getByTestId("roster-imported")).toHaveText("6 responden berhasil disimpan.");

  await page.getByRole("button", { name: "Terbitkan tautan" }).click();
  await expect(page.getByTestId("issued-links")).toHaveAttribute("data-count", "6");
  links = (await page.getByTestId("issued-link").allTextContents()).map((l) => new URL(l.trim()).pathname);
  expect(links).toHaveLength(6);

  // Hanya asesor utama yang memulai pengumpulan data.
  await page.goto(base);
  await expect(page.getByRole("button", { name: "Ubah status menjadi Pengumpulan data" })).toHaveCount(0);
  await transition(await lead.newPage(), "Ubah status menjadi Pengumpulan data", "Pengumpulan data");
});

test("lima responden mengisi survei di telepon genggam", async ({ browser }) => {
  test.setTimeout(240_000);
  const labels = ["Setuju", "Sangat setuju", "Ragu-ragu", "Tidak setuju"];
  for (const [r, path] of links.slice(0, 5).entries()) {
    const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await context.newPage();
    await page.goto(path);
    await page.getByRole("main").getByRole("button", { name: "Bahasa Indonesia" }).click();
    await expect(page.getByTestId("survey-consent")).toContainText("PT Siklus Konstruksi");
    await page.getByRole("button", { name: "Saya setuju dan mulai survei" }).click();
    await page.getByRole("button", { name: "Mulai" }).click();
    const next = page.getByRole("button", { name: "Lanjut", exact: true });
    for (let n = 1; n <= 18; n++) {
      await expect(page.getByTestId("survey-question")).toHaveText(`Bagian A · Pertanyaan ${n} dari 18`);
      await page.getByTestId("survey-characteristic").locator("label.survey-card").nth((n + r) % 5).click();
      await next.click();
    }
    for (let s = 1; s <= 7; s++) {
      const items = page.getByTestId("survey-climate").getByTestId("survey-climate-item");
      for (let i = 0; i < (await items.count()); i++) await items.nth(i).getByText(labels[(i + s + r) % labels.length] as string, { exact: true }).click();
      await next.click();
    }
    await page.getByTestId("survey-submit").click();
    await expect(page.getByTestId("survey-done")).toBeVisible({ timeout: 30_000 });
    await context.close();
  }
  const page = await admin.newPage();
  await page.goto(`${base}/participation`);
  await expect(page.getByTestId("participation-completed")).toHaveText("5");
});

test("dua asesor menilai bukti setiap karakteristik", async () => {
  test.setTimeout(300_000);
  for (const [context, offset] of [[lead, 0], [assessor, 0.5]] as const) {
    const page = await context.newPage();
    for (const [i, code] of CHARACTERISTICS.entries()) {
      await page.goto(`${base}/scoring/${code}`);
      await page.getByLabel("Nilai", { exact: true }).selectOption(String(2.5 + (i % 3) * 0.5 + offset));
      await page.getByLabel("Alasan").fill(`Bukti ${code} diperiksa; praktik berjalan tetapi belum merata di proyek.`);
      await page.getByRole("button", { name: "Simpan nilai" }).click();
      await expect(page.getByTestId("rating-saved")).toBeVisible();
    }
  }
});

test("survei ditutup, mesin dijalankan, rapat panel menetapkan hasil", async () => {
  test.setTimeout(180_000);
  const client = await admin.newPage();
  await client.goto(`${base}/respondents`);
  await client.getByLabel("Ditutup").fill(wibInput(0));
  await client.getByRole("button", { name: "Simpan jendela survei" }).click();
  await expect(client.getByText("Perubahan berhasil disimpan.")).toBeVisible();

  const page = await lead.newPage();
  await transition(page, "Ubah status menjadi Penilaian", "Penilaian");
  await page.goto(`${base}/scoring`);
  await page.getByRole("button", { name: "Jalankan mesin penilaian" }).click();
  await expect(page.getByTestId("run-done")).toContainText("Mesin selesai dijalankan. Indeks organisasi");
  await transition(page, "Ubah status menjadi Rapat panel asesor", "Rapat panel asesor");

  await page.goto(`${base}/panel`);
  await expect(page.getByTestId("matrix-row")).toHaveCount(18);
  await page.getByLabel("Saya memahami hasil tidak dapat diubah setelah ditetapkan.").check();
  await page.getByRole("button", { name: "Tetapkan hasil" }).click();
  await expect(page.getByTestId("final-ribbon")).toContainText("Ditetapkan rapat panel pada");
  await transition(page, "Ubah status menjadi Penyusunan rencana aksi", "Penyusunan rencana aksi");
});

test("laporan ditandatangani, status menjadi Dilaporkan, dan seluruh transisi tercatat", async () => {
  test.setTimeout(120_000);
  const page = await lead.newPage();
  await page.goto(`${base}/report`);
  await page.getByRole("button", { name: "Susun versi laporan baru" }).click();
  await expect(page.getByTestId("report-created")).toBeVisible();
  const version = page.getByTestId("report-version").first();
  await version.getByLabel("Jabatan penanda tangan").fill("Lead Assessor Nusa Safety");
  await version.getByLabel("Saya telah memeriksa isi laporan dan menyetujuinya sebagai versi final.").check();
  await version.getByRole("button", { name: "Finalisasi dan tandatangani versi 1" }).click();
  await expect(page.getByTestId("report-version").first()).toHaveAttribute("data-status", "FINAL");
  await transition(page, "Ubah status menjadi Dilaporkan", "Dilaporkan");

  // Jejak audit memuat setiap transisi dari Draf sampai Dilaporkan.
  await page.goto(`${base}/audit`);
  await expect(page.locator('[data-testid="audit-entry"][data-action="assessment.status_change"]')).toHaveCount(7);
  for (const action of ["assessment.create", "roster.import", "token.issue", "score.run", "panel.finalize", "report.create", "report.finalize"]) {
    await expect(page.locator(`[data-testid="audit-entry"][data-action="${action}"]`).first()).toBeVisible();
  }
  // Jawaban survei tidak pernah tercatat per responden di jejak audit (anonimitas, docs/02 bagian 4).
  await expect(page.locator('[data-testid="audit-entry"][data-action^="survey."]')).toHaveCount(0);

  // Administrator klien melihat hasil final di dasbor.
  const client = await admin.newPage();
  await client.goto(`${base}/dashboard`);
  await expect(client.getByTestId("final-note")).toBeVisible();
  await expect(client.getByTestId("draft-ribbon")).toHaveCount(0);
  await expect(client.getByTestId("card-index")).toHaveText(/^\d,\d{2}$/);
});
