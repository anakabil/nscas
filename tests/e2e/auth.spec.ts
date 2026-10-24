// Alur autentikasi: verifikasi dua langkah, aktivasi wajib, penguncian akun, kata sandi sementara,
// dan header keamanan (docs/04 bagian 3 dan 5).

import { expect, test } from "@playwright/test";
import { errorAlert, fixtures, login, submitPassword, totpCode, type Fixtures } from "./helpers";

// Dibaca di beforeAll karena berkas data uji baru dibuat saat server uji disiapkan.
let f: Fixtures;
test.beforeAll(() => {
  f = fixtures();
});

test("header keamanan terpasang", async ({ page }) => {
  const response = await page.goto("/login");
  const headers = response!.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});

test("kode verifikasi salah ditolak, kode benar diterima", async ({ page }) => {
  await submitPassword(page, f.users.adminB.email, f.password);
  await expect(page).toHaveURL(/\/login\/verify$/, { timeout: 30_000 });
  const code = totpCode(f.totpSecrets.adminB);
  await page.getByLabel("Kode verifikasi").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await expect(errorAlert(page)).toContainText("Kode tidak sesuai");

  await page.getByLabel("Kode verifikasi").fill(code);
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await expect(page).toHaveURL(/\/assessments$/);
  await expect(page.getByRole("heading", { name: "Asesmen" })).toBeVisible();
});

test("peran yang mewajibkan verifikasi dua langkah harus mengaktifkannya sebelum memakai konsol", async ({ page }) => {
  await login(page, "newAdminA");
  // Belum mengaktifkan: konsol dan API ditolak, diarahkan ke pengaturan akun.
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Peran Anda mewajibkan verifikasi dua langkah")).toBeVisible();
  expect((await page.request.get(`/api/assessments/${f.assessments.a}`)).status()).toBe(403);

  await page.getByRole("link", { name: "Atur verifikasi dua langkah" }).first().click();
  await expect(page).toHaveURL(/\/account\/security$/);
  await expect(page.getByRole("img", { name: "Kode QR untuk aplikasi autentikator" })).toBeVisible();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Kode verifikasi").fill(totpCode(secret));
  await page.getByRole("button", { name: "Aktifkan" }).click();

  await expect(page.getByText("Verifikasi dua langkah berhasil diaktifkan.")).toBeVisible();
  const codes = await page.getByTestId("backup-codes").locator("li").allTextContents();
  expect(codes).toHaveLength(10);
  for (const c of codes) expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

  await page.getByRole("link", { name: "Lanjut ke konsol" }).click();
  await expect(page).toHaveURL(/\/assessments$/);
  expect((await page.request.get(`/api/assessments/${f.assessments.a}`)).status()).toBe(200);
});

test("akun dikunci setelah 5 kali gagal dan kata sandi benar tetap ditolak selama terkunci", async ({ page }) => {
  const email = f.users.lockoutUser.email;
  for (let i = 1; i <= 4; i++) {
    await submitPassword(page, email, `salah-${i}-kata-sandi`);
    await expect(errorAlert(page)).toContainText("Surel atau kata sandi tidak sesuai");
  }
  await submitPassword(page, email, "salah-5-kata-sandi");
  await expect(errorAlert(page)).toContainText("Akun dikunci sementara");
  await submitPassword(page, email, f.password);
  await expect(errorAlert(page)).toContainText("Akun dikunci sementara");
});

test("kata sandi sementara wajib diganti sebelum memakai konsol", async ({ page }) => {
  await login(page, "tempPasswordUser");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Anda masuk dengan kata sandi sementara")).toBeVisible();

  await page.getByLabel("Kata sandi saat ini").fill(f.password);
  await page.getByLabel("Kata sandi baru", { exact: true }).fill("Kata-Sandi-Baru-Yang-Panjang");
  await page.getByLabel("Ulangi kata sandi baru").fill("Kata-Sandi-Baru-Yang-Panjang");
  await page.getByRole("button", { name: "Simpan kata sandi" }).click();
  await expect(page.getByText("Kata sandi berhasil diganti.")).toBeVisible();

  await page.goto("/assessments");
  await expect(page.getByRole("heading", { name: "Asesmen" })).toBeVisible();
});

test("keluar mengakhiri sesi di server", async ({ page }) => {
  await login(page, "coordinatorA");
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get(`/api/assessments/${f.assessments.a}`)).status()).toBe(401);
});
