import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./tests/e2e/database-url";

// Server uji memakai port dan basis data tersendiri (nscas_e2e, lihat tests/e2e/setup-db.ts),
// sehingga data pengembangan tidak tersentuh.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Mode pengembangan mengompilasi rute saat pertama dibuka; batas tunggu bawaan 5 detik terlalu ketat.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Memakai Chromium yang sudah terpasang bila versi bawaan Playwright tidak tersedia.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // Survei dirancang untuk telepon genggam lebih dulu (docs/05 bagian 3). Tes autentikasi hanya di
    // desktop: satu kode TOTP tidak dapat dipakai dua kali, sehingga satu pengguna tidak boleh masuk
    // bersamaan dari dua proyek.
    // Daftar izin, bukan pengecualian, agar spesifikasi konsol baru tidak ikut berjalan di sini tanpa sengaja.
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] }, testMatch: [/health\.spec\.ts/, /survey.*\.spec\.ts/] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Build produksi: tidak ada kompilasi rute saat tes berjalan (sumber kegagalan sesekali di mode
        // pengembangan), dan yang diuji adalah kode yang akan dipasang. E2E_DEV_SERVER=1 untuk mode pengembangan.
        command: process.env.E2E_DEV_SERVER
          ? `npx tsx tests/e2e/setup-db.ts && npx next dev -p ${PORT}`
          : `npx tsx tests/e2e/setup-db.ts && npx next build && npx next start -p ${PORT}`,
        url: baseURL,
        // Selalu server baru, agar tidak pernah memakai server pengembangan dengan basis data asli.
        reuseExistingServer: false,
        timeout: 420_000,
        // E2E_DATABASE_URL dikirim eksplisit agar skrip penyiapan memakai alamat yang sama tanpa menambah akhiran lagi.
        env: { E2E_DATABASE_URL: e2eDatabaseUrl(), DATABASE_URL: e2eDatabaseUrl(), AUTH_URL: baseURL },
      },
});
