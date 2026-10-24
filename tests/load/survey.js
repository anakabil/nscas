// Uji beban survei dengan k6 (Fase 15, docs/01 bagian 5: 300 pengisian bersamaan tanpa penurunan berarti).
//
// Setiap pengguna virtual memakai satu token survei berbeda dan menjalankan alur responden di sisi server:
// membuka halaman survei, menandai tautan dibuka, mengisi (waktu tunggu), lalu mengirim jawaban lengkap.
// Skenario "baseline" (satu pengguna, lima kali berurutan) menjadi pembanding. Profil dipilih dengan PROFILE:
//   realistic  300 responden mulai dalam 60 detik dan mengisi 2 sampai 4 menit, sehingga sekitar 300 pengisian
//              berjalan bersamaan (docs/01 bagian 5).
//   burst      300 responden membuka halaman pada detik yang sama dan mengirim dalam jendela sekitar satu detik;
//              jauh lebih berat daripada pola nyata, untuk melihat batas.
// TOKEN_START menggeser indeks token agar uji dapat diulang tanpa memakai token yang sudah terkirim.
//
// Persiapan (basis data terpisah, bukan produksi):
//   DATABASE_URL=.../nscas_load npm run demo -- --stop-at DATA_COLLECTION --tokens-out .demo/tokens.json
//   DATABASE_URL=.../nscas_load SURVEY_RATE_LIMIT_PER_MINUTE=100000 npx next start -p 3300
//   k6 run -e BASE_URL=http://localhost:3300 tests/load/survey.js
//
// Batas laju rute survei dilonggarkan karena seluruh permintaan berasal dari satu alamat IP mesin uji.

import { check, sleep } from "k6";
import exec from "k6/execution";
import http from "k6/http";

const data = JSON.parse(open(__ENV.TOKENS_FILE || "../../.demo/tokens.json"));
// BASE_URLS (dipisah koma) membagi pengguna virtual ke beberapa proses aplikasi, meniru penyeimbang beban Caddy.
const BASES = (__ENV.BASE_URLS || __ENV.BASE_URL || "http://localhost:3300").split(",");
const VUS = Number(__ENV.VUS || 300);
const PROFILE = __ENV.PROFILE || "realistic";
const START = Number(__ENV.TOKEN_START || 0);
const BASELINE_ITERATIONS = 5;

if (data.tokens.length < START + VUS + BASELINE_ITERATIONS) throw new Error(`need ${START + VUS + BASELINE_ITERATIONS} unused tokens, got ${data.tokens.length}`);

export const options = {
  scenarios: {
    baseline: { executor: "per-vu-iterations", vus: 1, iterations: BASELINE_ITERATIONS, exec: "fill", startTime: "0s", maxDuration: "1m", env: { OFFSET: String(START) } },
    concurrent: { executor: "per-vu-iterations", vus: VUS, iterations: 1, exec: "fill", startTime: "30s", maxDuration: "10m", env: { OFFSET: String(START + BASELINE_ITERATIONS) } },
  },
  thresholds: {
    "http_req_failed{scenario:concurrent}": ["rate==0"],
    "checks{scenario:concurrent}": ["rate==1"],
    "http_req_duration{scenario:concurrent,step:page}": ["p(95)<2000"],
    "http_req_duration{scenario:concurrent,step:submit}": ["p(95)<2000"],
    // Ambang longgar hanya agar garis dasar ikut tercantum di ringkasan sebagai pembanding.
    "http_req_duration{scenario:baseline,step:page}": ["p(95)<10000"],
    "http_req_duration{scenario:baseline,step:submit}": ["p(95)<10000"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function answers() {
  return {
    language: "id",
    stratumId: null,
    durationSeconds: 600 + Math.floor(Math.random() * 600),
    characteristics: data.characteristics.map((c) => ({ characteristicId: c.id, statementId: Math.random() < 0.05 ? null : pick(c.statementIds) })),
    climate: data.climateItems.map((id) => ({ itemId: id, value: 1 + Math.floor(Math.random() * 5) })),
  };
}

export function fill() {
  const index = Number(__ENV.OFFSET) + exec.scenario.iterationInTest;
  const token = data.tokens[index];
  const concurrent = exec.scenario.name === "concurrent";
  const BASE = BASES[exec.scenario.iterationInTest % BASES.length];
  // Profil realistis: kedatangan menyebar dalam 60 detik.
  if (concurrent && PROFILE === "realistic") sleep(Math.random() * 60);

  const page = http.get(`${BASE}/s/${token}`, { tags: { step: "page" } });
  check(page, { "halaman survei 200": (r) => r.status === 200, "halaman memuat persetujuan": (r) => r.body.includes("survey-consent") || r.body.includes("Saya setuju") });

  const opened = http.post(`${BASE}/s/${token}/open`, null, { tags: { step: "open" } });
  check(opened, { "tanda dibuka 204": (r) => r.status === 204 });

  // Waktu mengisi: 2 sampai 4 menit pada profil realistis; sekitar 2 detik pada profil lonjakan dan garis dasar.
  sleep(concurrent && PROFILE === "realistic" ? 120 + Math.random() * 120 : 2 + Math.random());

  const submit = http.post(`${BASE}/s/${token}/submit`, JSON.stringify(answers()), { headers: { "Content-Type": "application/json" }, tags: { step: "submit" } });
  check(submit, { "kiriman 201": (r) => r.status === 201 });
}
