// Fase 10: penilaian asesor dan rapat panel (docs/01 M8). Asesor menilai bukti tanpa melihat nilai rekan lebih
// dulu; asesor utama mengisi jalur setara, menjalankan mesin, menyesuaikan nilai di rapat panel, lalu menetapkan.

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
  await login(await lead.newPage(), "leadScoring");
  await login(await assessor.newPage(), "assessorScoring");
});

test.afterAll(async () => {
  await Promise.all([lead.close(), assessor.close()]);
});

test("nilai asesor lain tersembunyi sampai asesor menyimpan nilainya sendiri", async () => {
  const page = await assessor.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/scoring`);
  const row = page.getByTestId("rating-row").and(page.locator('[data-code="K2.1"]'));
  await expect(row.getByTestId("rating-raters")).toHaveText("1");
  await expect(row.getByTestId("rating-own")).toHaveText("Belum dinilai");

  await page.getByRole("link", { name: "Nilai K2.1" }).click();
  await expect(page.getByTestId("workspace-title")).toContainText("K2.1");
  await expect(page.getByTestId("workspace-statements").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("others-hidden")).toHaveText("1 asesor lain sudah menilai. Nilai mereka ditampilkan setelah Anda menyimpan nilai Anda.");
  await expect(page.getByTestId("other-rating")).toHaveCount(0);
  await expect(page.getByText("Kebijakan K3 ditinjau tahunan")).toHaveCount(0);

  await expect(page.getByLabel("Nilai", { exact: true }).locator("option")).toHaveText(["Pilih nilai", "1,0", "1,5", "2,0", "2,5", "3,0", "3,5", "4,0", "4,5", "5,0"]);
  await page.getByLabel("Nilai", { exact: true }).selectOption("3.5");
  await page.getByLabel("Alasan").fill("Cukup baik");
  await page.getByRole("button", { name: "Simpan nilai" }).click();
  await expect(page.getByText("Alasan terlalu singkat. Tulis paling sedikit 20 karakter.")).toBeVisible();

  await page.getByLabel("Alasan").fill("Kebijakan ada, tetapi sosialisasi di proyek belum merata.");
  await page.getByRole("button", { name: "Simpan nilai" }).click();
  await expect(page.getByTestId("rating-saved")).toBeVisible();
  await expect(page.getByTestId("other-rating")).toHaveCount(1);
  await expect(page.getByTestId("other-rating")).toContainText("4,0");
  await expect(page.getByTestId("other-rating")).toContainText("Kebijakan K3 ditinjau tahunan");

  await page.getByRole("link", { name: "Kembali ke daftar karakteristik" }).click();
  await expect(row.getByTestId("rating-own")).toHaveText("3,5");
  await expect(row.getByTestId("rating-raters")).toHaveText("2");
});

test("asesor utama mengisi jalur setara Safety Culture Ladder; asesor hanya membaca", async () => {
  const page = await lead.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/scoring/scl`);
  await expect(page.getByTestId("scl-status")).toContainText("Belum lengkap");
  const a1 = page.getByTestId("scl-A1");
  for (const [step, percent] of [[2, "90"], [3, "82,5"], [4, "70"], [5, "50"]] as const) {
    await a1.getByLabel(`Pemenuhan tingkat ${step} (persen)`).fill(percent);
    await a1.getByLabel(`Alasan tingkat ${step}`).fill(step === 5 ? "Kurang" : `Kriteria tingkat ${step} sebagian besar terpenuhi.`);
  }
  await a1.getByRole("button", { name: "Simpan aspek A1" }).click();
  await expect(a1.getByText("Alasan setiap tingkat wajib diisi, paling sedikit 10 karakter.")).toBeVisible();
  await a1.getByLabel("Alasan tingkat 5").fill("Kriteria tingkat 5 baru sebagian terpenuhi.");
  await a1.getByRole("button", { name: "Simpan aspek A1" }).click();
  await expect(a1.getByText("Aspek tersimpan.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("scl-A1").getByLabel("Pemenuhan tingkat 3 (persen)")).toHaveValue("82,5");

  const other = await assessor.newPage();
  await other.goto(`/assessments/${f.assessments.survey}/scoring/scl`);
  await expect(other.getByText("Hanya lead assessor yang mengisi jalur setara", { exact: false })).toBeVisible();
  await expect(other.getByRole("button", { name: "Simpan aspek A1" })).toHaveCount(0);
});

test("mesin dijalankan, rapat panel menyesuaikan nilai dengan alasan, lalu hasil ditetapkan dan terkunci", async () => {
  test.setTimeout(120_000);
  const page = await lead.newPage();
  const base = `/assessments/${f.assessments.panel}`;
  await page.goto(`${base}/scoring`);
  await page.getByRole("button", { name: "Jalankan mesin penilaian" }).click();
  await expect(page.getByTestId("run-done")).toContainText("Mesin selesai dijalankan. Indeks organisasi");
  await page.reload();
  await expect(page.getByTestId("run-row")).toHaveCount(1);

  await page.getByRole("link", { name: "Buka rapat panel" }).click();
  await expect(page.getByTestId("draft-ribbon")).toHaveText("Draf, belum ditetapkan rapat panel");
  const matrixRow = (code: string) => page.getByTestId("matrix-row").and(page.locator(`[data-code="${code}"]`));
  await expect(page.getByTestId("matrix-row")).toHaveCount(18);
  await expect(matrixRow("K1.3").getByTestId("matrix-flag")).toContainText(["Selisih persepsi dan bukti"]);
  await expect(matrixRow("K3.1").getByTestId("matrix-flag")).toContainText(["Perlu rekonsiliasi"]);
  await expect(page.getByTestId("reconcile-list")).toContainText("K3.1");
  await expect(page.getByTestId("reconcile-list")).toContainText("nilai asesor 2,00 sampai 4,00");
  await expect(page.getByTestId("divergence-list")).toContainText("K1.3");
  // Saat status masih penilaian, penyesuaian belum dapat dilakukan.
  await expect(page.getByTestId("adjustment-form")).toHaveCount(0);
  await expect(page.getByText("Penyesuaian dan penetapan hanya dapat dilakukan saat asesmen berstatus rapat panel.")).toBeVisible();

  await page.goto(base);
  await page.getByRole("button", { name: "Ubah status menjadi Rapat panel asesor" }).click();
  // Panel transisi berikutnya muncul setelah status berubah.
  await expect(page.getByRole("button", { name: "Ubah status menjadi Penyusunan rencana aksi" })).toBeVisible();

  await page.goto(`${base}/panel`);
  const engineIndex = (await page.getByTestId("summary-engine-index").textContent()) as string;
  await expect(page.getByTestId("summary-current-index")).toHaveText(engineIndex);
  await page.getByLabel("Karakteristik", { exact: true }).selectOption("K1.3");
  await page.getByLabel("Nilai panel").fill("3,00");
  await page.getByLabel("Alasan").fill("Singkat");
  await page.getByRole("button", { name: "Simpan penyesuaian" }).click();
  await expect(page.getByText("Alasan terlalu singkat. Tulis paling sedikit 20 karakter.")).toBeVisible();
  await page.getByLabel("Alasan").fill("Wawancara dan observasi menunjukkan pelaporan berjalan, meski dokumen belum lengkap.");
  await page.getByRole("button", { name: "Simpan penyesuaian" }).click();
  await expect(page.getByTestId("adjustment-saved")).toBeVisible();
  await expect(matrixRow("K1.3").getByTestId("matrix-panel")).toHaveText("3,00");
  await expect(matrixRow("K1.3").getByTestId("matrix-final")).toHaveText("2,50");
  await expect(page.getByTestId("adjustment-item")).toContainText("K1.3: 2,50 menjadi 3,00");
  await expect(page.getByTestId("summary-current-index")).not.toHaveText(engineIndex);

  // Asesor dapat membaca rapat panel, tetapi tidak dapat menyesuaikan atau menetapkan.
  const other = await assessor.newPage();
  await other.goto(`${base}/panel`);
  await expect(other.getByTestId("adjustment-item")).toContainText("K1.3: 2,50 menjadi 3,00");
  await expect(other.getByTestId("adjustment-form")).toHaveCount(0);
  await expect(other.getByRole("button", { name: "Tetapkan hasil" })).toHaveCount(0);

  await page.getByLabel("Saya memahami hasil tidak dapat diubah setelah ditetapkan.").check();
  await page.getByRole("button", { name: "Tetapkan hasil" }).click();
  // Pesan sukses formulir hanya sesaat: revalidasi halaman langsung melepas formulir karena hasil sudah final,
  // sehingga yang diperiksa adalah pita status final yang bertahan.
  await expect(page.getByTestId("final-ribbon")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("final-ribbon")).toContainText("Ditetapkan rapat panel pada");
  await expect(page.getByTestId("draft-ribbon")).toHaveCount(0);
  await expect(page.getByTestId("adjustment-form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hapus penyesuaian K1.3" })).toHaveCount(0);
  await expect(matrixRow("K1.3").getByTestId("matrix-panel")).toHaveText("3,00");

  await page.goto(base);
  await page.getByRole("button", { name: "Ubah status menjadi Penyusunan rencana aksi" }).click();
  await expect(page.getByRole("button", { name: "Ubah status menjadi Penyusunan rencana aksi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ubah status menjadi Dilaporkan" })).toBeVisible();
});
