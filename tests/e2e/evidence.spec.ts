// Fase 8: bukti (docs/01 M5) dan observasi digital (docs/01 M6). Koordinator unit mengunggah bukti langsung ke
// penyimpanan objek, lalu mengambil foto dan video dari kamera (perangkat kamera dan lokasi disimulasikan).

import { expect, test, type BrowserContext } from "@playwright/test";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

let f: Fixtures;
let coordinator: BrowserContext;
const pdf = (text: string) => Buffer.from(`%PDF-1.7\n% ${text}\n${"0".repeat(4000)}\n%%EOF`);

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  coordinator = await browser.newContext({ permissions: ["camera", "geolocation"], geolocation: { latitude: -6.2089, longitude: 106.8457, accuracy: 15 } });
  await login(await coordinator.newPage(), "coordinatorSurvey");
});

test.afterAll(async () => {
  await coordinator.close();
});

test("koordinator mengunggah bukti, memetakannya, membuat versi baru, dan unduhan melalui pemeriksaan hak akses", async () => {
  test.setTimeout(120_000);
  const page = await coordinator.newPage();
  await page.goto(`/assessments/${f.assessments.survey}/evidence`);
  // Koordinator hanya dapat mengunggah untuk unitnya; pilihan tingkat organisasi tidak ditawarkan.
  await expect(page.locator("#new-unit option")).toHaveText(["Proyek Survei Timur"]);

  await page.locator("#new-file").setInputFiles({ name: "risalah-rapat-direksi.pdf", mimeType: "application/pdf", buffer: pdf("risalah") });
  await page.locator("#new-title").fill("Risalah rapat direksi Oktober");
  await page.getByTestId("new-map-K1.1").check();
  await page.getByText("Risalah rapat direksi", { exact: true }).first().click();
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
  await expect(page.getByTestId("evidence-uploaded")).toHaveText("Bukti tersimpan (versi 1).");

  const item = page.getByTestId("evidence-item").filter({ hasText: "Risalah rapat direksi Oktober" });
  await expect(item).toBeVisible();
  await expect(item.getByTestId("evidence-codes")).toHaveText("K1.1");
  await expect(item).toContainText("application/pdf");
  const k11 = page.getByTestId("evidence-checklist-row").filter({ hasText: "K1.1" });
  await expect(k11).toHaveAttribute("data-below", "true");
  await expect(k11).toContainText("1 jenis bukti");

  // Berkas yang menyamar (HTML bernama .pdf) ditolak setelah isinya diperiksa.
  await page.locator("#new-file").setInputFiles({ name: "laporan.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await page.locator("#new-title").fill("Berkas menyamar");
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
  await expect(page.getByText("Jenis berkas tidak diizinkan atau isinya tidak sesuai dengan ekstensinya.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("evidence-item").filter({ hasText: "Berkas menyamar" })).toHaveCount(0);

  // Versi baru mewarisi pemetaan; versi lama tetap dapat diunduh.
  await item.getByRole("button", { name: "Unggah versi baru" }).click();
  await item.locator('input[type="file"]').setInputFiles({ name: "risalah-rapat-direksi-rev.pdf", mimeType: "application/pdf", buffer: pdf("revisi") });
  await item.getByRole("button", { name: "Unggah", exact: true }).click();
  await expect(item.getByTestId("evidence-uploaded")).toHaveText("Bukti tersimpan (versi 2).");
  await page.reload();
  const updated = page.getByTestId("evidence-item").filter({ hasText: "Risalah rapat direksi Oktober" });
  await expect(updated).toContainText("Versi 2");
  await expect(updated.getByTestId("evidence-codes")).toHaveText("K1.1");

  const href = (await updated.getByTestId("evidence-download").getAttribute("href")) as string;
  const redirect = await page.request.get(href, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toContain("X-Amz-Signature=");
  const file = await page.request.get(redirect.headers().location as string);
  expect((await file.body()).toString("latin1")).toContain("% revisi");
});

test("aplikasi observasi dapat dipasang sebagai PWA dan tidak menyediakan pilihan galeri", async () => {
  const page = await coordinator.newPage();
  const manifest = await page.request.get("/o/manifest.webmanifest");
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  const json = await manifest.json();
  expect(json).toMatchObject({ start_url: "/o", scope: "/o", display: "standalone" });
  expect((await page.request.get(json.icons[1].src)).status()).toBe(200);

  await page.goto("/o");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/o/manifest.webmanifest");
  await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration("/o")))).toBe(true);
  await page.getByTestId("observe-window").filter({ hasText: "Observasi area kerja pekan pertama" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${f.observationWindows.open}$`));
  await expect(page.locator('input[type="file"]')).toHaveCount(0);

  await page.goto(`/o/${f.observationWindows.closed}`);
  await expect(page.getByTestId("observe-closed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nyalakan kamera" })).toBeDisabled();
});

test("foto dan video dari kamera terkirim dengan waktu server; di luar radius ditandai", async () => {
  test.setTimeout(120_000);
  const page = await coordinator.newPage();
  await page.goto(`/o/${f.observationWindows.open}`);
  await page.getByRole("button", { name: "Nyalakan kamera" }).click();
  await expect(page.getByTestId("observe-video")).toBeVisible();

  await page.getByRole("button", { name: "Ambil foto" }).click();
  await expect(page.getByTestId("observe-preview")).toBeVisible();
  await page.getByTestId("observe-send").click();
  await expect(page.getByTestId("observe-sent")).toContainText("Rekaman terkirim pukul");

  // Di luar radius 500 meter: tetap diterima tetapi ditandai.
  await coordinator.setGeolocation({ latitude: -6.25, longitude: 106.8456, accuracy: 20 });
  await page.locator("select").selectOption("O2");
  await page.getByRole("button", { name: "Rekam video" }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Selesai merekam" }).click();
  await expect(page.getByTestId("observe-preview")).toBeVisible();
  await page.getByTestId("observe-send").click();
  await expect(page.getByTestId("observe-sent")).toContainText("di luar radius proyek");

  await page.goto(`/assessments/${f.assessments.survey}/observations`);
  const window = page.getByTestId("observation-window").filter({ hasText: "Observasi area kerja pekan pertama" });
  await expect(window.getByTestId("observation-capture")).toHaveCount(2);
  await expect(window.locator('[data-testid="observation-capture"][data-outside="true"]')).toHaveCount(1);
  const thumbnail = window.locator("img").first();
  // Gambar mini dimuat malas; gulir agar peramban memuatnya melalui rute unduh yang memeriksa hak akses.
  await thumbnail.scrollIntoViewIfNeeded();
  await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});
