// Fase 7: penilaian mandiri manajemen (docs/01 M4). Administrator klien menerbitkan tautan, pengisi melihat
// pemberitahuan bahwa penilaian ini teridentifikasi, mengisi 18 karakteristik dengan alasan minimal 50 karakter,
// draf tersimpan di server, lalu status terkirim mengunci jawaban.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

let f: Fixtures;
let admin: BrowserContext;
let link: string;

const reason = (n: number) => `Karakteristik ${n}: rapat keselamatan bulanan dipimpin manajer proyek dan tindak lanjutnya dipantau setiap minggu.`;

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  admin = await browser.newContext();
  await login(await admin.newPage(), "adminSurvey");
});

test.afterAll(async () => {
  await admin.close();
});

test("administrator klien menerbitkan tautan penilaian mandiri", async () => {
  const page = await admin.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/self-assessments`);
  await page.getByLabel("Nama", { exact: true }).fill("Ir. Bambang Wijaya");
  await page.getByLabel("Jabatan", { exact: true }).fill("Direktur Operasi");
  await page.getByLabel("Unit", { exact: true }).selectOption({ label: "Proyek Survei Timur" });
  await page.getByRole("button", { name: "Terbitkan tautan" }).click();
  await expect(page.getByTestId("sa-link")).toHaveText(/\/sa\/[A-Za-z0-9_-]{43}$/);
  link = ((await page.getByTestId("sa-link").textContent()) as string).trim();
  await page.reload();
  await expect(page.getByTestId("sa-row")).toHaveAttribute("data-status", "NOT_OPENED");
  // Tautan hanya ditampilkan sekali.
  await expect(page.getByTestId("sa-link")).toHaveCount(0);
});

async function fillCharacteristic(page: Page, n: number, justification: string) {
  const step = page.getByTestId("sa-characteristic");
  await expect(page.getByTestId("sa-position")).toHaveText(`Karakteristik ${n} dari 18`);
  const cards = step.locator("label.survey-card");
  await expect(cards).toHaveCount(5);
  for (const text of await cards.allTextContents()) expect(text).not.toMatch(/^\s*\d|Tingkat/);
  await cards.nth(n % 5).click();
  await page.getByTestId("sa-justification").fill(justification);
  await page.getByTestId("sa-next").click();
}

test("pengisi melihat pemberitahuan teridentifikasi, menyimpan draf di server, lalu mengirim dan terkunci", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(new URL(link).pathname);
  await expect(page.getByTestId("sa-identified")).toContainText("Penilaian mandiri ini teridentifikasi");
  await expect(page.getByTestId("sa-identified")).toContainText("tidak anonim");
  await page.getByRole("button", { name: "Mulai penilaian" }).click();

  // Belum ada bukti di asesmen ini: diberi peringatan, tetapi tetap dapat dilanjutkan.
  await expect(page.getByTestId("sa-no-evidence")).toBeVisible();
  await page.getByTestId("sa-justification").fill("Terlalu singkat.");
  await expect(page.getByTestId("sa-counter")).toHaveText("16 dari minimal 50 karakter");
  for (let n = 1; n <= 3; n++) {
    if (n > 1) await page.getByTestId("sa-justification").fill("");
    await fillCharacteristic(page, n, reason(n));
  }

  // Layar berikutnya tampil setelah penyimpanan ke server berhasil.
  await expect(page.getByTestId("sa-position")).toHaveText("Karakteristik 4 dari 18");

  // Draf tersimpan di server: halaman dimuat ulang tetap memuat jawaban.
  await page.reload();
  await page.getByRole("button", { name: "Mulai penilaian" }).click();
  await expect(page.getByTestId("sa-justification")).toHaveValue(reason(1));
  await expect(page.getByTestId("sa-characteristic").locator("label.survey-card:has(input:checked)")).toHaveCount(1);
  await page.getByLabel("Lompat ke karakteristik").selectOption({ index: 3 });
  for (let n = 4; n <= 18; n++) await fillCharacteristic(page, n, n === 18 ? "Masih kurang." : reason(n));

  // Pemeriksaan akhir: alasan karakteristik 18 kurang dari 50 karakter sehingga belum dapat dikirim.
  await expect(page.getByTestId("sa-review")).toBeVisible();
  await expect(page.getByTestId("sa-missing")).toHaveAttribute("data-count", "1");
  await expect(page.getByTestId("sa-submit")).toBeDisabled();
  await page.getByRole("button", { name: "Ubah" }).click();
  await page.getByTestId("sa-justification").fill(reason(18));
  await page.getByTestId("sa-next").click();
  await expect(page.getByText("Semua karakteristik sudah lengkap.")).toBeVisible();
  await page.getByTestId("sa-submit").click();

  await expect(page.getByTestId("sa-submitted")).toContainText("Penilaian mandiri sudah dikirim");
  await expect(page.getByTestId("sa-submitted")).toContainText(reason(18));

  // Terkunci: perubahan melalui rute ditolak.
  const locked = await page.request.put(`${new URL(link).pathname}/answer`, { data: { characteristicId: "x", statementId: null, justification: "", evidenceIds: [] } });
  expect(locked.status()).toBe(409);
  await context.close();
});

test("konsol menampilkan status terkirim dan jawaban beserta alasannya", async () => {
  const page = await admin.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/self-assessments`);
  const row = page.getByTestId("sa-row").filter({ hasText: "Ir. Bambang Wijaya" });
  await expect(row).toHaveAttribute("data-status", "SUBMITTED");
  await expect(row).toContainText("18 dari 18");
  await expect(row.getByRole("button", { name: "Cabut tautan" })).toHaveCount(0);
  await row.getByRole("link", { name: "Lihat jawaban" }).click();
  await expect(page.getByTestId("sa-detail-respondent")).toHaveText("Ir. Bambang Wijaya, Direktur Operasi");
  await expect(page.getByTestId("sa-detail-row")).toHaveCount(18);
  await expect(page.getByTestId("sa-detail-row").first()).toContainText(reason(1));
});
