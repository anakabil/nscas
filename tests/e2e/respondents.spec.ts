// Fase 5: manajemen responden (docs/01 M2). Cara memeriksa: impor berkas contoh 50 responden, kirim undangan,
// lalu buka Mailpit di http://localhost:8025. Tes ini menjalankan worker pg-boss sebentar agar surel benar-benar
// terkirim ke Mailpit, lalu memeriksanya melalui API Mailpit.

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { e2eDatabaseUrl } from "./database-url";
import { fixtures, login, type Fixtures } from "./helpers";

test.describe.configure({ mode: "serial" });

const MAILPIT = "http://localhost:8025";
const run = Date.now().toString(36);
const domain = `gamma-${run}.test`;
const HEADER = "Nama;Nomor induk;Surel;Telepon;Unit;Strata;Penyedia jasa";
const UNITS = ["Proyek Gedung Utama", "Proyek Jembatan Barat"];

/** 50 responden: 30 pertama bersurel, 20 sisanya tanpa surel (pekerja lapangan dan penyedia jasa). */
function sampleCsv(): Buffer {
  const rows = Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    const email = n <= 30 ? `r${n}@${domain}` : "";
    return [`Responden Gamma ${n}`, `G-${run}-${n}`, email, n % 2 ? `08129${String(1_000_000 + n)}` : "", UNITS[i % 2], `S${(i % 5) + 1}`, i % 5 === 4 ? "Ya" : "Tidak"].join(";");
  });
  return Buffer.from(`﻿${[HEADER, ...rows].join("\r\n")}\r\n`, "utf8");
}

/** Nilai isian datetime-local dalam WIB. */
function wibInput(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 16);
}

async function mailpitCount(query: string): Promise<number> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}&limit=100`);
  return ((await res.json()) as { messages_count: number }).messages_count;
}

let f: Fixtures;
let base: string;
let worker: ChildProcess | null = null;
// Satu sesi administrator untuk seluruh berkas: satu kode TOTP tidak dapat dipakai dua kali dalam 30 detik.
let admin: BrowserContext;

test.beforeAll(async ({ browser }) => {
  f = fixtures();
  base = `/assessments/${f.assessments.c}`;
  admin = await browser.newContext();
  await login(await admin.newPage(), "adminC");
});

test.afterAll(async () => {
  worker?.kill("SIGTERM");
  await admin.close();
});

async function chooseFile(page: Page, name: string, buffer: Buffer) {
  await page.getByLabel("Berkas daftar responden").setInputFiles({ name, mimeType: "text/csv", buffer });
}

test("administrator klien mengimpor 50 responden, mengirim undangan ke Mailpit, dan membagikan tautan", async ({ baseURL }) => {
  test.setTimeout(240_000);
  const page = await admin.newPage();
  await page.goto(`${base}/respondents`);
  await expect(page.getByTestId("assessment-status")).toHaveText("Parameter dikunci");

  // Jendela survei dalam WIB.
  await page.getByLabel("Dibuka").fill(wibInput(-1));
  await page.getByLabel("Ditutup").fill(wibInput(14));
  await page.getByRole("button", { name: "Simpan jendela survei" }).click();
  await expect(page.getByText("Perubahan berhasil disimpan.")).toBeVisible();

  // Templat Excel dapat diunduh.
  const template = await page.request.get(`/api/assessments/${f.assessments.c}/respondents/template`);
  expect(template.status()).toBe(200);
  expect(template.headers()["content-type"]).toContain("spreadsheetml");

  // Berkas bergalat: pratinjau menampilkan galat per baris dan tombol simpan tidak muncul.
  await chooseFile(page, "galat.csv", Buffer.from(`${HEADER}\nTanpa Unit;;bukan-surel;;;S9;\n`));
  await page.getByRole("button", { name: "Periksa berkas" }).click();
  await expect(page.getByTestId("preview-error")).toHaveCount(3);
  await expect(page.getByText("Unit wajib diisi.")).toBeVisible();
  await expect(page.getByTestId("roster-commit")).toHaveCount(0);

  // Berkas contoh 50 responden.
  await chooseFile(page, "daftar-responden.csv", sampleCsv());
  await page.getByRole("button", { name: "Periksa berkas" }).click();
  await expect(page.getByTestId("preview-valid")).toHaveAttribute("data-value", "50");
  await expect(page.getByTestId("preview-errors")).toHaveAttribute("data-value", "0");
  await page.getByRole("button", { name: "Simpan 50 responden" }).click();
  await expect(page.getByTestId("roster-imported")).toHaveText("50 responden berhasil disimpan.");
  await page.reload();
  await expect(page.getByTestId("roster-registered")).toHaveAttribute("data-value", "50");
  await expect(page.getByTestId("roster-with-email")).toHaveAttribute("data-value", "30");

  // Undangan surel: diantre, lalu dikirim worker pg-boss.
  await page.getByRole("button", { name: "Kirim undangan" }).click();
  await expect(page.getByTestId("invitations-queued")).toHaveAttribute("data-count", "30");

  const mailpitUp = await fetch(`${MAILPIT}/api/v1/info`).then((r) => r.ok, () => false);
  if (mailpitUp) {
    // Satu proses Node (tanpa npx) agar SIGTERM menghentikan worker itu sendiri.
    worker = spawn(process.execPath, ["--conditions=react-server", "--env-file-if-exists=.env", "--import", "tsx", "src/worker.ts"], {
      env: { ...process.env, DATABASE_URL: e2eDatabaseUrl(), APP_URL: baseURL },
      stdio: "ignore",
    });
    await expect.poll(() => mailpitCount(`to:"${domain}"`), { timeout: 90_000, intervals: [2_000] }).toBe(30);
    await expect.poll(() => mailpitCount(`to:"r1@${domain}" subject:"Undangan survei"`), { timeout: 10_000 }).toBe(1);
    worker.kill("SIGTERM");
    worker = null;
  }

  // Tautan untuk responden tanpa surel: ditampilkan sekali dan diekspor ke CSV.
  await page.getByRole("button", { name: "Terbitkan tautan" }).click();
  await expect(page.getByTestId("issued-links")).toHaveAttribute("data-count", "20");
  await expect(page.getByTestId("issued-link").first()).toHaveText(/\/s\/[A-Za-z0-9_-]{43}$/);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-links").click()]);
  const csv = readFileSync((await download.path()) as string, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.trim().split("\r\n");
  expect(lines).toHaveLength(21);
  // trim() juga membuang BOM, yang sudah diperiksa di atas.
  expect(lines[0]).toBe('"Nama";"Nomor induk";"Unit";"Strata";"Tautan"');
  expect(lines[1]).toMatch(/;"https?:\/\/[^"]+\/s\/[A-Za-z0-9_-]{43}"$/);

  // Status token per orang: diterbitkan atau dicabut, tanpa status selesai.
  await page.reload();
  if (mailpitUp) await expect(page.getByTestId("roster-tokens")).toHaveAttribute("data-value", "50");
  await page.getByLabel("Cari nama atau nomor induk").fill("Responden Gamma 45");
  await page.getByRole("button", { name: "Terapkan" }).click();
  const row = page.getByTestId("roster-row");
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId("token-state")).toHaveAttribute("data-state", "ISSUED");
  page.once("dialog", (d) => d.accept());
  await row.getByText("Kelola token").click();
  await row.getByRole("button", { name: "Cabut" }).click();
  await expect(row.getByText("Token dicabut.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("roster-row").getByTestId("token-state")).toHaveAttribute("data-state", "REVOKED");
  await page.getByTestId("roster-row").getByText("Kelola token").click();
  await page.getByTestId("roster-row").getByRole("button", { name: "Terbitkan ulang tautan" }).click();
  await expect(page.getByTestId("reissued-link")).toHaveText(/\/s\/[A-Za-z0-9_-]{43}$/);
});

test("kode QR unit dicetak di lembar A4 dan menolak pemindaian sebelum pengumpulan data", async () => {
  const page = await admin.newPage();
  await page.goto(`${base}/respondents/qr`);
  await page.getByLabel("Unit").selectOption({ label: "Proyek Jembatan Barat" });
  await page.getByLabel("Batas penerbitan token").fill("200");
  await page.getByRole("button", { name: "Buat kode QR" }).click();
  const sheet = page.getByTestId("qr-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("qr-sheet-unit")).toHaveText("Proyek Jembatan Barat");
  await expect(sheet.getByTestId("qr-image")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
  await expect(page.getByTestId("qr-print")).toBeVisible();
  await expect(page.getByTestId("qr-print-sheet")).toBeHidden();
  const link = (await sheet.getByTestId("qr-link").textContent())?.trim() as string;
  expect(link).toMatch(/\/q\/[A-Za-z0-9_-]{43}$/);

  // Tampilan cetak hanya memuat lembar kode QR, tepat satu halaman A4.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("qr-print-sheet")).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("assessment-status")).toBeHidden();
  const pdf = await page.pdf({ format: "A4" });
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
  await page.emulateMedia({ media: "screen" });
  await page.reload();
  await expect(page.getByTestId("qr-row")).toHaveCount(1);

  // Status asesmen masih Terkunci: pemindaian belum menerbitkan token.
  const scan = await page.request.get(new URL(link).pathname, { maxRedirects: 0 });
  expect(scan.status()).toBe(303);
  expect(scan.headers()["referrer-policy"]).toBe("no-referrer");
  await page.goto(new URL(link).pathname);
  await expect(page).toHaveURL(/\/q\/unavailable\?reason=CLOSED$/);
  await expect(page.getByTestId("qr-unavailable")).toHaveText(/Survei sedang tidak dibuka/);
});

test("dasbor partisipasi menandai strata di bawah 30 persen", async () => {
  const page = await admin.newPage();
  await page.goto(`${base}/participation`);
  await expect(page.getByTestId("participation-stratum")).toHaveCount(5);
  await expect(page.getByTestId("strata-below-count")).toHaveAttribute("data-count", "5");
  await expect(page.getByTestId("strata-below-count")).toHaveText("5 strata di bawah ambang partisipasi minimum 30 persen.");
  await expect(page.getByTestId("participation-stratum").first().getByText("Di bawah 30 persen")).toBeVisible();
  await expect(page.getByTestId("participation-unit")).toHaveCount(2);
  await expect(page.getByTestId("participation-registered")).toHaveText("50");
});

test("koordinator unit hanya melihat unitnya dan tidak dapat mendistribusikan token", async ({ page }) => {
  await login(page, "coordinatorC");
  await page.goto(`${base}/respondents`);
  await expect(page.getByTestId("roster-registered")).toHaveAttribute("data-value", "25");
  await expect(page.getByTestId("roster-row").first()).toBeVisible();
  for (const unitCell of await page.getByTestId("roster-row").locator("td:nth-child(3)").allTextContents()) {
    expect(unitCell).toBe("Proyek Gedung Utama");
  }
  await expect(page.getByText("Impor daftar responden", { exact: true })).toBeVisible();
  await expect(page.getByText("Distribusi token", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Kode QR" })).toHaveCount(0);

  await page.goto(`${base}/participation`);
  await expect(page.getByTestId("participation-unit")).toHaveCount(1);
  await expect(page.getByTestId("participation-stratum")).toHaveCount(0);

  await page.goto(`${base}/respondents/qr`);
  await expect(page).toHaveURL(/\/forbidden$/);
});
