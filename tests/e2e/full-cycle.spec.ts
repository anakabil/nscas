// Fase R12: satu siklus penuh asesmen dari Draf sampai Pemantauan (docs/01 bagian 3). Asesor utama membuat asesmen
// dan menjalankan setiap transisi status dari pusat asesmen; seorang pekerja mengisi survei dari telepon; aksi kunci
// (tutup survei, tinjauan mutu data, usulan sesi, perhitungan, penetapan panel, penerbitan rencana aksi, tanda tangan
// laporan, komunikasi hasil) dijalankan lewat antarmuka. Langkah berulang (unit dan parameter, daftar responden,
// jawaban survei lainnya, nilai sesi validasi dan nilai bukti, analisis kesenjangan) dikerjakan perintah
// nscas:e2e-cycle lewat layanan yang sama, sehingga setiap syarat transisi tetap diperiksa sungguhan.

import { execFileSync } from 'node:child_process';
import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const PASSWORD = process.env.E2E_PASSWORD ?? 'UjiSiklus2026';
const errors: string[] = [];
let lead: BrowserContext;
let admin: BrowserContext;
let id = '';

/** Langkah pembantu lewat layanan, pada basis data uji yang sama dengan server. */
function assist(step: string): string {
    return execFileSync('php', ['artisan', 'nscas:e2e-cycle', step, `--assessment=${id}`], {
        env: process.env,
        encoding: 'utf8',
    }).trim();
}

async function signIn(browser: Browser, email: string): Promise<BrowserContext> {
    const context = await browser.newContext();
    const page = await context.newPage();
    watch(page);
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.click('[data-test=login-button]');
    await page.waitForURL(/\/home/);
    await page.close();
    return context;
}

/** Galat JavaScript dan respons 5xx dikumpulkan dan diperiksa di akhir. */
function watch(page: Page) {
    page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
    page.on('response', (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
    });
    page.on('dialog', (d) => d.accept());
}

async function open(context: BrowserContext, path: string): Promise<Page> {
    const page = await context.newPage();
    watch(page);
    await page.goto(`/assessments/${id}${path}`);
    return page;
}

/** Transisi oleh asesor utama dari pusat asesmen; status dibaca ulang dari basis data. */
async function moveTo(status: string) {
    const page = await open(lead, '');
    const button = page.getByTestId('transition-button');
    if ((await button.count()) === 0) {
        throw new Error(`Transisi ke ${status} belum dapat dijalankan:\n${await page.getByTestId('next-step').innerText()}`);
    }
    await button.click();
    await expect.poll(() => assist('status')).toBe(status);
    await page.close();
}

test.beforeAll(async ({ browser }) => {
    lead = await signIn(browser, 'utama@e2e.test');
    admin = await signIn(browser, 'klien@e2e.test');
});

test.afterAll(async () => {
    await lead?.close();
    await admin?.close();
});

test('tahap 1: asesmen dibuat, direncanakan, dan dikunci', async () => {
    const page = await lead.newPage();
    watch(page);
    await page.goto('/assessments/create');
    await page.selectOption('#organization_id', { label: 'PT Siklus Konstruksi' });
    await page.fill('#name', 'Asesmen Budaya K3 Siklus Uji');
    await page.fill('#period_start', '2026-10-01');
    await page.fill('#period_end', '2027-01-31');
    await page.click('button[type=submit]');
    // Asesmen baru dibuka di halaman rinciannya (tahap 1).
    await page.waitForURL(/\/assessments\/[0-9a-z]{26}\/setup$/);
    id = page.url().split('/').at(-2) as string;
    expect(assist('status')).toBe('DRAFT');

    assist('plan');
    await moveTo('CONFIGURED');
    await moveTo('LOCKED');
});

test('tahap 2: responden, survei dari telepon, penilaian mandiri, dan gerbang mutu data', async ({ browser }) => {
    const roster = JSON.parse(assist('roster')) as { links: number; first: string };
    expect(roster.links).toBe(60);
    await moveTo('DATA_COLLECTION');

    // Seorang pekerja mengisi survei dari telepon.
    const phone = await browser.newContext({ ...devices['Pixel 7'] });
    const survey = await phone.newPage();
    watch(survey);
    await survey.goto(new URL(roster.first, 'http://127.0.0.1').pathname);
    await survey.click('.sv-card[lang=id]');
    await survey.click('[data-testid=survey-accept]');
    await survey.click('[data-testid=survey-start]');
    for (let n = 0; (await survey.locator('[data-testid=survey-characteristic]').count()) > 0; n++) {
        await survey
            .locator('[data-testid=survey-characteristic] label')
            .nth(n % 5)
            .click();
        await survey.click('[data-testid=survey-next]');
    }
    while ((await survey.locator('[data-testid=survey-climate]').count()) > 0) {
        const items = survey.locator('[data-testid=survey-climate-item]');
        for (let i = 0; i < (await items.count()); i++) await items.nth(i).locator('label').nth(3).click();
        await survey.click('[data-testid=survey-next]');
    }
    await survey.click('[data-testid=survey-submit]');
    await expect(survey.getByTestId('survey-done')).toBeVisible();
    await phone.close();

    const sent = JSON.parse(assist('responses')) as { surveys: number };
    expect(sent.surveys).toBe(40);

    const respondents = await open(lead, '/respondents');
    await respondents.getByTestId('close-survey').click();
    await expect(respondents.getByTestId('close-survey')).toHaveCount(0);

    assist('quality');
    const quality = await open(lead, '/data-quality');
    await quality.getByTestId('review-submit-DATA_QUALITY').click();
    await quality.waitForLoadState('networkidle');

    const validation = await open(lead, '/validation');
    await validation.getByTestId('proposal-create').click();
    await expect(validation.getByTestId('session-list')).toBeVisible();
    await moveTo('VALIDATION');
});

test('tahap 3 dan 4: validasi lapangan, penilaian asesor, dan rapat panel', async () => {
    assist('validate');
    await moveTo('SCORING');

    assist('rate');
    const scoring = await open(lead, '/scoring');
    await scoring.getByTestId('score-run').click();
    await expect(scoring.getByTestId('score-runs')).toBeVisible();
    await moveTo('PANEL_REVIEW');

    assist('panel');
    const panel = await open(lead, '/panel');
    await panel.getByTestId('finalize').click();
    await expect(panel.getByTestId('finalize')).toHaveCount(0);
    await moveTo('ACTION_PLANNING');
});

test('tahap 5 dan 6: rencana aksi, laporan bertanda tangan, komunikasi hasil, dan pemantauan', async () => {
    assist('actions');
    const gaps = await open(admin, '/gaps');
    await gaps.getByTestId('gaps-publish').click();
    await expect(gaps.getByTestId('gaps-publish')).toHaveCount(0);

    const sign = async (kind: 'FULL' | 'WORKER_SUMMARY') => {
        const report = await open(lead, '/report');
        await report.getByTestId(`report-save-${kind}`).click();
        await report.getByTestId('report-sign').first().click();
        await report.getByTestId('sign-confirm').click();
        await expect(report.getByTestId('report-sign')).toHaveCount(0);
        await report.close();
    };
    await sign('FULL');
    await moveTo('REPORTED');

    await sign('WORKER_SUMMARY');
    const communication = await open(admin, '/communication');
    await communication.fill('#comm-audience', 'Seluruh pekerja Proyek Siklus Utara');
    await communication.getByRole('checkbox').first().check();
    await communication.getByTestId('communication-save').click();
    await expect(communication.getByTestId('communication-records')).toBeVisible();
    await moveTo('MONITORING');

    // Hasil terbaca oleh klien, dan setiap transisi tercatat di jejak audit.
    const dashboard = await open(admin, '/dashboard');
    await expect(dashboard.getByTestId('results-cards')).toBeVisible();
    const audit = await open(lead, '/audit?category=assessment');
    await expect(audit.getByTestId('audit-entries')).toContainText('Status asesmen berubah');
    expect(errors).toEqual([]);
});
