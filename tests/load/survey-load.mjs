// Uji beban survei responden (fase R12, docs/01 bagian 5: 300 pengisian bersamaan tanpa penurunan berarti).
//
// Setiap responden maya memakai satu token berbeda dan menjalankan alur halaman responden di sisi server: membuka
// halaman survei, menandai tautan dibuka, lalu mengirim jawaban lengkap. Lima pengisian berurutan lebih dulu menjadi
// garis dasar. Profil:
//   burst      semua responden membuka halaman pada saat yang sama lalu langsung mengirim; jauh lebih berat daripada
//              pola nyata, untuk melihat batas.
//   realistic  responden mulai tersebar dalam 60 detik dan mengisi 20 sampai 40 detik (dipersingkat dari 2 sampai
//              4 menit nyata agar uji selesai cepat; jumlah kiriman per detik tetap lebih tinggi daripada pola nyata).
// Responden dibagi ke beberapa alamat IP (X-Forwarded-For, server memakai TRUSTED_PROXIES='*') untuk meniru beberapa
// lokasi proyek; pembatas laju per alamat di server tidak diubah.
//
// Persiapan (basis data uji, bukan produksi):
//   DB_DATABASE=nscas_laravel_e2e php artisan migrate:fresh --seed --force
//   DB_DATABASE=nscas_laravel_e2e php artisan nscas:e2e-cycle load      # 330 token -> storage/app/private/e2e/load.json
//   jalankan image produksi dengan DB_DATABASE=nscas_laravel_e2e dan TRUSTED_PROXIES='*' (docs/15)
//   node tests/load/survey-load.mjs --base=http://127.0.0.1:8200 --profile=burst
//
// Tanpa dependensi: memakai fetch bawaan Node 22.

import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const BASE = args.base ?? 'http://127.0.0.1:8200';
const FILE = args.file ?? 'storage/app/private/e2e/load.json';
const VUS = Number(args.vus ?? 300);
const PROFILE = args.profile ?? 'burst';
const OFFSET = Number(args.offset ?? 0);
const SITES = Number(args.sites ?? 10);
const BASELINE = 5;

const data = JSON.parse(readFileSync(FILE, 'utf8'));
if (data.tokens.length < OFFSET + BASELINE + VUS) {
    throw new Error(`perlu ${OFFSET + BASELINE + VUS} token yang belum dipakai, tersedia ${data.tokens.length - OFFSET}`);
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const answers = () => ({
    language: 'id',
    stratumId: null,
    durationSeconds: 600 + Math.floor(Math.random() * 600),
    characteristics: data.characteristics.map((c) => ({
        characteristicId: c.id,
        statementId: Math.random() < 0.05 ? null : pick(c.statementIds),
    })),
    climate: data.climateItems.map((id) => ({ itemId: id, value: 1 + Math.floor(Math.random() * 5) })),
});

async function timed(step, url, init, expect, samples, failures) {
    const started = performance.now();
    try {
        const res = await fetch(url, init);
        const body = await res.text();
        samples[step].push(performance.now() - started);
        if (res.status !== expect || (step === 'submit' && !body.includes('"ok":true')))
            failures.push(`${step} ${res.status} ${body.slice(0, 80)}`);
    } catch (e) {
        samples[step].push(performance.now() - started);
        failures.push(`${step} ${e.message}`);
    }
}

async function fill(token, ip, samples, failures, thinkMs) {
    const headers = { 'X-Forwarded-For': ip, 'User-Agent': 'nscas-load' };
    await timed('page', `${BASE}/s/${token}`, { headers }, 200, samples, failures);
    await timed('open', `${BASE}/s/${token}/open`, { method: 'POST', headers }, 204, samples, failures);
    if (thinkMs > 0) await sleep(thinkMs);
    await timed(
        'submit',
        `${BASE}/s/${token}/submit`,
        {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(answers()),
        },
        201,
        samples,
        failures,
    );
}

function stats(list) {
    const s = [...list].sort((a, b) => a - b);
    const q = (p) => (s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : 0);
    const r = (v) => Math.round(v);
    return {
        n: s.length,
        avg: r(s.reduce((a, b) => a + b, 0) / (s.length || 1)),
        p50: r(q(50)),
        p90: r(q(90)),
        p95: r(q(95)),
        p99: r(q(99)),
        max: r(s.at(-1) ?? 0),
    };
}

const empty = () => ({ page: [], open: [], submit: [] });
const baseline = empty();
const baselineFailures = [];
for (let i = 0; i < BASELINE; i++) await fill(data.tokens[OFFSET + i], '10.20.0.1', baseline, baselineFailures, 0);

const load = empty();
const failures = [];
const started = performance.now();
await Promise.all(
    data.tokens.slice(OFFSET + BASELINE, OFFSET + BASELINE + VUS).map(async (token, i) => {
        const ip = `10.30.${i % SITES}.${1 + (i % 200)}`;
        if (PROFILE === 'realistic') await sleep(Math.random() * 60_000);
        await fill(token, ip, load, failures, PROFILE === 'realistic' ? 20_000 + Math.random() * 20_000 : 0);
    }),
);
const seconds = (performance.now() - started) / 1000;

const report = {
    profile: PROFILE,
    vus: VUS,
    sites: SITES,
    durationSeconds: Math.round(seconds * 10) / 10,
    baseline: {
        page: stats(baseline.page),
        open: stats(baseline.open),
        submit: stats(baseline.submit),
        failures: baselineFailures.length,
    },
    concurrent: {
        page: stats(load.page),
        open: stats(load.open),
        submit: stats(load.submit),
        failures: failures.length,
        firstFailures: failures.slice(0, 5),
    },
};
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
