// Bagian murni skrip demo (Fase 15): pembangkit acak berbenih, nama fiktif, struktur organisasi demo,
// model jawaban survei, dan berkas PDF contoh. Tanpa I/O agar dapat diuji (tests/unit/demo-model.test.ts).
//
// Semua data bersifat fiktif. Nama dibentuk dari daftar nama umum Indonesia secara acak; surel memakai
// domain .test yang tidak dapat menerima surat.

/** PRNG mulberry32: hasil sama untuk benih yang sama, sehingga data demo dapat dibuat ulang persis. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mean = 0, sd = 1) => {
    const u = Math.max(next(), 1e-12);
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    normal,
    uniform: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    chance: (p: number) => next() < p,
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

const FIRST_NAMES = [
  "Agus", "Ahmad", "Andi", "Arif", "Bambang", "Budi", "Dedi", "Dewi", "Dian", "Eko", "Fajar", "Fitri", "Hadi", "Hendra", "Indra",
  "Irfan", "Joko", "Kurniawan", "Lestari", "Made", "Mulyadi", "Nur", "Putu", "Rahmat", "Ratna", "Rina", "Rizki", "Sari", "Siti",
  "Slamet", "Sri", "Supriyadi", "Suryadi", "Taufik", "Teguh", "Wahyu", "Wayan", "Yanti", "Yogi", "Yusuf", "Zainal", "Asep", "Ujang",
  "Dodi", "Nyoman", "Ketut", "Gede", "Ilham", "Rudi", "Hasan",
];
const LAST_NAMES = [
  "Pratama", "Saputra", "Wijaya", "Hidayat", "Santoso", "Susanto", "Gunawan", "Setiawan", "Kusuma", "Nugroho", "Siregar", "Nasution",
  "Simanjuntak", "Harahap", "Lubis", "Sitompul", "Tanjung", "Hakim", "Rahman", "Syahputra", "Purnomo", "Wibowo", "Utomo", "Firmansyah",
  "Permana", "Ramadhan", "Hutapea", "Manurung", "Pangaribuan", "Daulay", "Sembiring", "Ginting", "Tarigan", "Sinaga", "Situmorang",
  "Mahendra", "Prasetyo", "Haryanto", "Kartika", "Lumbantobing",
];

export function personName(rng: Random): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

/** Dua belas lokasi (satu kantor pusat dan sebelas kantor wilayah) dengan koordinat kota. */
export const LOCATIONS = [
  { name: "Kantor Pusat Jakarta", type: "HEAD_OFFICE", city: "Jakarta", latitude: -6.2088, longitude: 106.8456 },
  { name: "Wilayah Medan", type: "BRANCH", city: "Medan", latitude: 3.5952, longitude: 98.6722 },
  { name: "Wilayah Palembang", type: "BRANCH", city: "Palembang", latitude: -2.9761, longitude: 104.7754 },
  { name: "Wilayah Bandung", type: "BRANCH", city: "Bandung", latitude: -6.9175, longitude: 107.6191 },
  { name: "Wilayah Semarang", type: "BRANCH", city: "Semarang", latitude: -6.9667, longitude: 110.4167 },
  { name: "Wilayah Surabaya", type: "BRANCH", city: "Surabaya", latitude: -7.2575, longitude: 112.7521 },
  { name: "Wilayah Denpasar", type: "BRANCH", city: "Denpasar", latitude: -8.65, longitude: 115.2167 },
  { name: "Wilayah Balikpapan", type: "BRANCH", city: "Balikpapan", latitude: -1.2379, longitude: 116.8529 },
  { name: "Wilayah Makassar", type: "BRANCH", city: "Makassar", latitude: -5.1477, longitude: 119.4327 },
  { name: "Wilayah Manado", type: "BRANCH", city: "Manado", latitude: 1.4748, longitude: 124.8421 },
  { name: "Wilayah Kupang", type: "BRANCH", city: "Kupang", latitude: -10.1772, longitude: 123.607 },
  { name: "Wilayah Jayapura", type: "BRANCH", city: "Jayapura", latitude: -2.5337, longitude: 140.7181 },
] as const;

const PROJECT_KINDS = ["Jalan Tol", "Bendungan", "Gedung Perkantoran", "Jembatan", "Pelabuhan", "Rumah Sakit", "Jalur Kereta", "Instalasi Air Minum", "Bandar Udara", "Rusun"];

export interface DemoProject {
  name: string;
  locationIndex: number;
  latitude: number;
  longitude: number;
}

/** Empat puluh proyek di sebelas kantor wilayah (kantor pusat tidak memiliki proyek), nama unik. */
export function demoProjects(rng: Random, count = 40): DemoProject[] {
  const projects: DemoProject[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const locationIndex = 1 + (i % (LOCATIONS.length - 1));
    const location = LOCATIONS[locationIndex]!;
    let name = "";
    for (let attempt = 0; attempt < 50 && (!name || used.has(name)); attempt++) {
      name = `Proyek ${rng.pick(PROJECT_KINDS)} ${location.city} ${rng.pick(["Utara", "Selatan", "Timur", "Barat", "Tengah", "Raya", "Baru", "Lingkar"])}`;
    }
    if (used.has(name)) name = `${name} ${i + 1}`;
    used.add(name);
    projects.push({ name, locationIndex, latitude: location.latitude + rng.uniform(-0.25, 0.25), longitude: location.longitude + rng.uniform(-0.25, 0.25) });
  }
  return projects;
}

/** Populasi strata 3.000 pekerja sesuai seed/fixtures/sampel-3000.json dan sasaran survei per strata (total 900). */
export const STRATA_POPULATION = { S1: 15, S2: 120, S3: 300, S4: 1800, S5: 765 } as const;
export const SURVEY_RESPONSES = { S1: 5, S2: 36, S3: 90, S4: 539, S5: 230 } as const;
export type StratumCode = keyof typeof STRATA_POPULATION;

/** Membagi count ke beberapa kelompok sebanding bobotnya dengan metode sisa terbesar; jumlahnya tepat count. */
export function allocateByWeight(weights: readonly number[], count: number): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (w / total) * count);
  const base = exact.map(Math.floor);
  const remainder = count - base.reduce((s, n) => s + n, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (let k = 0; k < remainder; k++) base[order[k]!.i]! += 1;
  return base;
}

/** Persepsi manajemen umumnya lebih tinggi daripada pekerja lapangan; selisih ini memunculkan kesenjangan persepsi. */
export const STRATUM_OFFSET: Record<StratumCode, number> = { S1: 0.55, S2: 0.35, S3: 0.1, S4: 0, S5: -0.25 };
const DONT_KNOW_RATE: Record<StratumCode, number> = { S1: 0.02, S2: 0.03, S3: 0.04, S4: 0.06, S5: 0.09 };

export interface InstrumentShape {
  characteristics: { id: string; code: string; statements: { id: string; level: number }[] }[];
  climateItems: { id: string; dimension: string; reverseCoded: boolean }[];
}

export interface RespondentProfile {
  /** Rata-rata kematangan unit tempat responden bekerja, skala 1 sampai 5. */
  unitMean: number;
  stratum: StratumCode;
}

export interface GeneratedResponse {
  language: "id" | "en";
  durationSeconds: number;
  characteristics: { characteristicId: string; statementId: string | null }[];
  climate: { itemId: string; value: number }[];
}

const clampLevel = (v: number) => Math.min(5, Math.max(1, Math.round(v)));

/**
 * Jawaban satu responden: kematangan laten = rata-rata unit + selisih strata + variasi individu. Setiap
 * karakteristik dan dimensi iklim memiliki efek tetap (characteristicEffect, dimensionEffect) agar profil
 * organisasi tidak datar. Sekitar 2,5 persen responden terlalu cepat dan 2 persen menjawab seragam,
 * sehingga panel mutu data memiliki contoh tanda.
 */
/** Simpangan baku komponen model. Dikalibrasi agar alfa Cronbach per dimensi iklim sekitar 0,75 sampai 0,85. */
export const RESPONSE_NOISE = { individual: 0.55, characteristic: 0.55, climate: 0.5 };

export function generateResponse(
  rng: Random,
  instrument: InstrumentShape,
  profile: RespondentProfile,
  effects: { characteristic: Record<string, number>; dimension: Record<string, number> },
  noise: typeof RESPONSE_NOISE = RESPONSE_NOISE,
): GeneratedResponse {
  const latent = profile.unitMean + STRATUM_OFFSET[profile.stratum] + rng.normal(0, noise.individual);
  const speeding = rng.chance(0.025);
  const straightlining = !speeding && rng.chance(0.02);
  const characteristics = instrument.characteristics.map((c) => {
    if (rng.chance(DONT_KNOW_RATE[profile.stratum])) return { characteristicId: c.id, statementId: null };
    const level = clampLevel(latent + (effects.characteristic[c.code] ?? 0) + rng.normal(0, noise.characteristic));
    const statement = c.statements.find((s) => s.level === level) ?? c.statements[0];
    return { characteristicId: c.id, statementId: statement ? statement.id : null };
  });
  const flat = clampLevel(latent + 0.8);
  const climate = instrument.climateItems.map((item) => {
    if (straightlining) return { itemId: item.id, value: flat };
    const agreement = clampLevel(latent + (effects.dimension[item.dimension] ?? 0) + rng.normal(0, noise.climate));
    return { itemId: item.id, value: item.reverseCoded ? 6 - agreement : agreement };
  });
  const durationSeconds = speeding ? rng.int(110, 230) : Math.round(Math.min(5400, Math.exp(rng.normal(Math.log(780), 0.35))));
  return { language: rng.chance(0.03) ? "en" : "id", durationSeconds, characteristics, climate };
}

/** Efek tetap per karakteristik dan dimensi iklim, berbenih. */
export function fixedEffects(rng: Random, characteristicCodes: readonly string[], dimensionCodes: readonly string[]) {
  return {
    characteristic: Object.fromEntries(characteristicCodes.map((code) => [code, rng.normal(0, 0.3)])),
    dimension: Object.fromEntries(dimensionCodes.map((code) => [code, rng.normal(0, 0.2)])),
  };
}

/** Pengambilan berbobot tanpa pengembalian (Efraimidis dan Spirakis). */
export function weightedSample<T>(rng: Random, items: readonly T[], weight: (item: T) => number, count: number): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(rng.next(), 1 / Math.max(weight(item), 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map((x) => x.item);
}

/** Bukti contoh tingkat organisasi: judul dan kode karakteristik yang didukung. */
export const ORGANIZATION_EVIDENCE: { title: string; characteristics: string[] }[] = [
  { title: "Risalah rapat direksi tentang kinerja K3 triwulan III", characteristics: ["K1.1"] },
  { title: "Jadwal dan catatan kunjungan direksi ke lapangan", characteristics: ["K1.1"] },
  { title: "Risalah rapat panitia pembina K3 bulanan", characteristics: ["K1.2"] },
  { title: "Register usulan pekerja dan tindak lanjutnya", characteristics: ["K1.2"] },
  { title: "Kebijakan penghargaan dan sanksi K3", characteristics: ["K1.3"] },
  { title: "Laporan investigasi kecelakaan dengan analisis akar masalah", characteristics: ["K2.1", "K5.2"] },
  { title: "Catatan berbagi pembelajaran kejadian antarproyek", characteristics: ["K2.1"] },
  { title: "Rencana kerja dan anggaran K3 tahun berjalan", characteristics: ["K2.2"] },
  { title: "Kebijakan K3 perusahaan yang ditandatangani direksi", characteristics: ["K2.2", "K1.1"] },
  { title: "Dokumen prakualifikasi K3 penyedia jasa", characteristics: ["K3.1"] },
  { title: "Klausul keselamatan dalam kontrak subkontraktor", characteristics: ["K3.1"] },
  { title: "Matriks kompetensi dan realisasi pelatihan K3", characteristics: ["K3.2"] },
  { title: "Struktur organisasi dan uraian jabatan unit K3", characteristics: ["K3.3"] },
  { title: "Daftar prosedur K3 dan riwayat revisi", characteristics: ["K4.3"] },
  { title: "Bukti sosialisasi prosedur kerja aman", characteristics: ["K4.3"] },
  { title: "Kebijakan pelaporan tanpa sanksi", characteristics: ["K5.1"] },
  { title: "Rekap jumlah dan jenis laporan hampir celaka semester I", characteristics: ["K5.1", "K6.2"] },
  { title: "Register tindakan perbaikan hasil investigasi", characteristics: ["K5.2"] },
  { title: "Program audit internal sistem manajemen K3", characteristics: ["K6.1"] },
  { title: "Laporan audit internal sistem manajemen K3", characteristics: ["K6.1"] },
  { title: "Statistik kecelakaan dan indikator utama K3", characteristics: ["K6.2"] },
  { title: "Rencana mutu pelaksanaan konstruksi", characteristics: ["KT.1"] },
  { title: "Kebijakan saluran pengaduan pekerja", characteristics: ["KT.2"] },
  { title: "Rekap pemanfaatan saluran pengaduan", characteristics: ["KT.2"] },
];

/** Bukti contoh tingkat proyek yang diunggah koordinator unit. */
export const PROJECT_EVIDENCE: { title: string; characteristics: string[] }[] = [
  { title: "Rencana keselamatan konstruksi proyek", characteristics: ["K4.1", "KT.1"] },
  { title: "Analisis keselamatan pekerjaan pengecoran", characteristics: ["K4.1"] },
  { title: "Laporan inspeksi K3 mingguan proyek", characteristics: ["K4.2"] },
  { title: "Catatan penghentian pekerjaan tidak aman", characteristics: ["K4.2"] },
  { title: "Risalah pertemuan keselamatan pagi", characteristics: ["K5.3"] },
  { title: "Materi komunikasi K3 harian", characteristics: ["K5.3"] },
  { title: "Catatan kunjungan manajer proyek ke lapangan", characteristics: ["K1.1"] },
  { title: "Catatan pemberian penghargaan pekerja teladan K3", characteristics: ["K1.3"] },
  { title: "Daftar hadir induksi K3 pekerja baru", characteristics: ["K3.2"] },
  { title: "Evaluasi kinerja K3 subkontraktor proyek", characteristics: ["K3.1"] },
  { title: "Laporan investigasi hampir celaka proyek", characteristics: ["K5.1", "K5.2"] },
  { title: "Rencana mutu dan keselamatan konstruksi proyek", characteristics: ["KT.1"] },
];

function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
}

/** PDF satu halaman yang sah (tabel xref benar), cukup untuk pratinjau dan pemeriksaan jenis berkas. */
export function samplePdf(title: string, lines: readonly string[]): Uint8Array {
  const body = [`BT /F1 16 Tf 56 780 Td (${pdfText(title)}) Tj ET`, ...lines.map((line, i) => `BT /F1 11 Tf 56 ${748 - i * 18} Td (${pdfText(line)}) Tj ET`)].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

/** Tanggal dan jam WIB dalam format isian datetime-local ("YYYY-MM-DDTHH:mm"). */
export function wibLocal(date: Date): string {
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}

/** Waktu acak pada jam kerja WIB (07.00 sampai 18.00) di antara dua tanggal. */
export function workingTime(rng: Random, from: Date, to: Date): Date {
  const day = new Date(from.getTime() + rng.next() * Math.max(0, to.getTime() - from.getTime()));
  const wib = new Date(day.getTime() + 7 * 3600_000);
  wib.setUTCHours(rng.int(7, 17), rng.int(0, 59), rng.int(0, 59), 0);
  const result = new Date(wib.getTime() - 7 * 3600_000);
  return result < from ? from : result > to ? to : result;
}
