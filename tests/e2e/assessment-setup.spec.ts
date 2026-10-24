// Fase 4: konfigurasi asesmen oleh asesor utama sampai dikunci (docs/01 M1 dan bagian 3).
// Cara memeriksa: asesmen organisasi demo dengan 3.000 pekerja; kalkulator menampilkan 33, 66, 353, 341, dan 901.

import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("asesor utama mengonfigurasi asesmen, kalkulator menghasilkan 33, 66, 353, 341, 901, lalu mengunci", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "leadAssessor");

  // Asesmen baru untuk organisasi demo.
  await page.goto("/assessments");
  await page.getByRole("link", { name: "Buat asesmen baru" }).click();
  await page.getByLabel("Organisasi klien").selectOption({ label: "PT Contoh Konstruksi" });
  await page.getByLabel("Nama asesmen").fill("Asesmen Budaya K3 Demo 2026");
  await page.getByLabel("Tanggal mulai").fill("2026-11-01");
  await page.getByLabel("Tanggal selesai").fill("2027-01-31");
  await page.getByRole("button", { name: "Buat asesmen" }).click();
  // Pola mengecualikan /assessments/new agar alamat dasar baru dicatat setelah pengalihan selesai.
  await expect(page).toHaveURL(/\/assessments\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  const base = new URL(page.url()).pathname;
  const assessmentId = base.split("/").pop()!;
  await expect(page.getByTestId("assessment-organization")).toHaveText("PT Contoh Konstruksi");
  await expect(page.getByTestId("assessment-status")).toHaveText("Draf");

  // Unit bertingkat, termasuk koordinat proyek.
  await page.goto(`${base}/setup/units`);
  await page.locator("#new-unit-name").fill("Kantor Pusat");
  await page.locator("#new-unit-type").selectOption("HEAD_OFFICE");
  await page.getByRole("button", { name: "Tambah unit" }).click();
  await expect(page.getByTestId("unit-tree")).toContainText("Kantor Pusat");
  await page.locator("#new-unit-name").fill("Proyek Jalan Tol Seksi 1");
  await page.locator("#new-unit-type").selectOption("PROJECT");
  await page.locator("#new-unit-parent").selectOption({ label: "Kantor Pusat" });
  await page.locator("#new-unit-lat").fill("-6,2088");
  await page.locator("#new-unit-lng").fill("106,8456");
  await page.locator("#new-unit-radius").fill("500");
  await page.getByRole("button", { name: "Tambah unit" }).click();
  await expect(page.getByTestId("unit-tree")).toContainText("Proyek Jalan Tol Seksi 1");
  await expect(page.getByTestId("unit-summary")).toHaveText("2 unit, termasuk 1 proyek");

  // Populasi lima strata bawaan: 3.000 pekerja.
  await page.goto(`${base}/setup/strata`);
  for (const [code, population] of [["S1", "15"], ["S2", "120"], ["S3", "300"], ["S4", "1800"], ["S5", "765"]]) {
    await page.getByLabel(`Populasi ${code}`).fill(population);
  }
  await page.getByRole("button", { name: "Simpan populasi" }).click();
  await expect(page.getByTestId("strata-total")).toHaveText("3.000");

  // Kalkulator sampel interaktif: 40 proyek dan 12 lokasi.
  await page.goto(`${base}/setup/sampling`);
  await expect(page.getByTestId("sample-plan-missing")).toBeVisible();
  await page.getByLabel("Jumlah proyek berjalan (N)").fill("40");
  await page.getByLabel("Jumlah lokasi (X)").fill("12");
  const value = (key: string) => page.getByTestId(`sample-${key}`).locator("[data-value]");
  await expect(value("interviewManagement")).toHaveText("33");
  await expect(value("interviewOperational")).toHaveText("66");
  await expect(value("slovin")).toHaveText("353");
  await expect(value("cochranInitial")).toHaveText("384,16");
  await expect(value("cochranCorrected")).toHaveText("341");
  await expect(value("recommended")).toHaveText("353");
  await expect(value("projectsToVisit")).toHaveText("4");
  await expect(value("locationsToVisit")).toHaveText("4");
  for (const [code, target] of [["S1", "5"], ["S2", "36"], ["S3", "90"], ["S4", "540"], ["S5", "230"]]) {
    await expect(page.getByTestId(`sample-target-${code}`)).toHaveText(target);
  }
  await expect(page.getByTestId("sample-target-total")).toHaveText("901");
  await page.getByRole("button", { name: "Simpan hasil kalkulator" }).click();
  await expect(page.getByTestId("sample-plan-saved")).toContainText("901");
  await page.screenshot({ path: test.info().outputPath("kalkulator-sampel.png"), fullPage: true });

  // Parameter: perjanjian pemrosesan data ditandatangani.
  await page.goto(`${base}/setup/parameters`);
  await expect(page.getByLabel("Persepsi", { exact: true })).toHaveValue("0,35");
  await page.getByLabel("Perjanjian pemrosesan data dengan klien sudah ditandatangani").check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Perubahan berhasil disimpan.")).toBeVisible();

  // Tim asesor: menugaskan asesor.
  await page.goto(`${base}/setup/team`);
  await page.getByLabel("Staf Nusa Safety").selectOption({ label: "assessorStaff (asesor@e2e.test)" });
  await page.getByRole("button", { name: "Tugaskan" }).click();
  await expect(page.getByTestId("team-table")).toContainText("asesor@e2e.test");

  // Transisi DRAFT ke CONFIGURED, lalu dikunci.
  await page.goto(base);
  await page.getByRole("button", { name: "Ubah status menjadi Terkonfigurasi" }).click();
  await expect(page.getByTestId("assessment-status")).toHaveText("Terkonfigurasi");
  await expect(page.getByTestId("overview-sample-target")).toHaveText("901");
  await page.getByRole("button", { name: "Kunci konfigurasi" }).click();
  await expect(page.getByTestId("assessment-status")).toHaveText("Parameter dikunci");

  // Setelah dikunci: API menolak perubahan dengan 409, formulir menjadi baca saja.
  const current = await page.request.get(`/api/assessments/${assessmentId}/parameters`);
  expect(current.status()).toBe(200);
  const body = await current.json();
  expect(body.locked).toBe(true);
  const put = await page.request.put(`/api/assessments/${assessmentId}/parameters`, {
    data: { parameters: body.parameters, consentTextId: "Diubah", consentTextEn: "Changed", dpaSigned: true },
  });
  expect(put.status()).toBe(409);
  expect(await put.json()).toMatchObject({ error: "CONFIGURATION_LOCKED" });

  const strata = await page.request.get(`/api/assessments/${assessmentId}`);
  expect(strata.status()).toBe(200);

  await page.goto(`${base}/setup/parameters`);
  await expect(page.getByTestId("configuration-locked")).toBeVisible();
  await expect(page.getByLabel("Persepsi", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Simpan", exact: true })).toHaveCount(0);
  await page.goto(`${base}/setup/strata`);
  await expect(page.getByRole("button", { name: "Simpan populasi" })).toHaveCount(0);
  await expect(page.getByTestId("strata-total")).toHaveText("3.000");
});
