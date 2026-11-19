import { defineConfig, devices } from '@playwright/test';

// Uji ujung ke ujung fase R12. Server uji memakai basis data tersendiri (nscas_laravel_e2e, tests/e2e/serve.sh) dan
// aset hasil `npm run build`, sehingga data pengembangan tidak tersentuh dan yang diuji adalah kode yang dipasang.
const PORT = Number(process.env.E2E_PORT ?? 8100);
const env = {
    E2E_PORT: String(PORT),
    DB_DATABASE: process.env.E2E_DATABASE ?? 'nscas_laravel_e2e',
    APP_ENV: 'local',
    APP_URL: `http://127.0.0.1:${PORT}`,
    NSCAS_ENFORCE_TWO_FACTOR: 'false',
    QUEUE_CONNECTION: 'sync',
    MAIL_MAILER: 'array',
    FILESYSTEM_DISK: 'local',
};
for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
}

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 300_000,
    expect: { timeout: 20_000 },
    fullyParallel: false,
    workers: 1,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        trace: 'off',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'bash tests/e2e/serve.sh',
        url: `http://127.0.0.1:${PORT}/login`,
        reuseExistingServer: false,
        timeout: 240_000,
        env,
    },
});
