# 03. Aturan Penilaian, Sampel, dan Mutu Data

Dokumen ini adalah spesifikasi mesin penilaian. Implementasi rujukan ada di `seed/fixtures/referensi_skoring.py`. Implementasi TypeScript di `src/lib/scoring/` wajib menghasilkan nilai yang sama dengan fixture pada toleransi 1e-6.

## 1. Prinsip umum

- Skala tingkat 1,00 sampai 5,00. Nama tingkat: 1 Patologis, 2 Reaktif, 3 Kalkulatif, 4 Proaktif, 5 Progresif.
- Perhitungan memakai presisi penuh. Pembulatan hanya saat ditampilkan (dua desimal, koma desimal).
- Perbandingan ambang memakai toleransi `EPS = 1e-9`. Contoh: `selisih >= 1.00 - EPS`.
- Pembulatan ke atas memakai `ceilSafe(x) = Math.ceil(x - EPS)` agar setara ROUNDUP Excel dan kebal galat floating point (misalnya `0,3 x 120`).
- Semua parameter dibaca dari `parameterSnapshot` asesmen yang terkunci.
- Karakteristik kontekstual (aspek `KT`) dihitung dan dilaporkan, tetapi tidak masuk indeks organisasi dan tidak memengaruhi tingkat.

## 2. Skor tiga lapisan per karakteristik `c`

### 2.1 Persepsi `P_c`

1. Ambil jawaban survei yang tidak dikeluarkan (`excluded = false`) dan bukan "Tidak tahu".
2. Hitung rata-rata per strata `m_s`.
3. Skor survei `S_c = jumlah(w_s x m_s) / jumlah(w_s)`, dengan `w_s` = populasi strata `s`, hanya untuk strata yang memiliki minimal satu jawaban. Pembobotan populasi mencegah strata terbesar mendominasi bila partisipasi tidak merata.
4. Skor penilaian mandiri `A_c` = rata-rata tingkat dari penilaian mandiri berstatus `SUBMITTED`.
5. `P_c = (1 - alfa) x S_c + alfa x A_c`, dengan `alfa = selfAssessmentWeightInPerception` (bawaan 0,30). Bila tidak ada penilaian mandiri, `P_c = S_c`.

### 2.2 Bukti objektif `E_c`

- Rata-rata nilai `EvidenceRating` dari para asesor untuk karakteristik tersebut (nilai 1,0 sampai 5,0, kelipatan 0,5).
- Tanda `PENILAI_TUNGGAL` bila hanya satu asesor menilai.
- Tanda `PERLU_REKONSILIASI` bila selisih nilai terbesar dan terkecil antarasesor lebih dari `assessorDisagreementFlag` (bawaan 1,00).

### 2.3 Validasi `V_c`

- Untuk setiap sesi validasi, rata-ratakan nilai para asesor pada karakteristik itu; lalu rata-ratakan antarsesi.
- Bila tidak ada sesi yang menilai karakteristik itu, `V_c` kosong.

## 3. Indeks karakteristik

```
G_c = (wP x P_c + wE x E_c + wV x V_c) / (jumlah bobot lapisan yang tersedia)
```

Bobot bawaan `wP = 0,35`, `wE = 0,40`, `wV = 0,25`. Lapisan yang kosong dikeluarkan dan bobot sisanya dinormalisasi; beri tanda `LAPISAN_TIDAK_LENGKAP`.

**Aturan selisih persepsi dan bukti.** Bila `|P_c - E_c| >= divergenceThreshold` (bawaan 1,00):

```
F_c = min(G_c, E_c)   dan beri tanda SELISIH_PERSEPSI_BUKTI
```

Bila tidak, `F_c = G_c`. Catatan: bila bukti lebih tinggi daripada persepsi, tanda tetap muncul tetapi nilai tidak berubah, karena `min` memilih `G_c`.

**Penyesuaian panel.** Nilai akhir yang dipakai untuk agregasi adalah `PanelAdjustment.adjustedValue` bila ada, selain itu `F_c`. Keduanya ditampilkan di laporan.

## 4. Agregasi

```
I_a = rata-rata F_c untuk karakteristik non-kontekstual dalam aspek a
W_a = maxPointsStep5_a / 18000
O   = jumlah(W_a x I_a) untuk A1 sampai A6
L   = min(5, max(1, floor(O + EPS)))
```

Bobot aspek: A1 26,67 persen; A2 10,00 persen; A3 19,17 persen; A4 17,78 persen; A5 21,94 persen; A6 4,44 persen.

**Kemantapan tingkat.** Tingkat `L` dinyatakan mantap (`consolidated = true`) bila:

```
min(I_a) >= L - 0,50   dan   min(F_c non-kontekstual) >= L - 1,00
```

**Keluaran tambahan:**
- `gapToTarget = targetLevel - O`, dan per aspek `targetLevel - I_a`
- `priorityAspect` = aspek dengan `I_a` terendah
- `contextualIndex` = rata-rata `F_c` karakteristik kontekstual

## 5. Jalur setara Safety Culture Ladder

Masukan: persentase pemenuhan `f(a, s)` per aspek `a` (A1 sampai A6) per tingkat `s` (2 sampai 5), dalam rentang 0 sampai 1.

```
rata(s)  = jumlah(W_a x f(a, s))
min(s)   = min_a f(a, s)
lulus(s) = rata(s) >= ambangRata(s) dan min(s) >= ambangMin(s)
```

| Tingkat | Ambang rata-rata tertimbang | Ambang minimum setiap aspek |
|---|---|---|
| 2 | 0,75 | 0,70 |
| 3 | 0,80 | 0,70 |
| 4 | 0,80 | 0,75 |
| 5 | 0,85 | 0,75 |

Tingkat indikatif = tingkat tertinggi `s` sehingga semua tingkat 2 sampai `s` lulus berurutan. Bila tingkat 2 gagal, hasilnya 1.

## 6. Kesenjangan persepsi antarlapisan

Untuk setiap aspek: rata-rata skor survei kelompok `MANAGEMENT` dikurangi rata-rata kelompok `FIELD` (pembobotan populasi dalam kelompok). Tandai bila selisih `>= perceptionGapAttention` (bawaan 0,50). Hanya ditampilkan bila kedua kelompok memiliki minimal 5 respons.

## 7. Kalkulator sampel

Masukan: `M` jumlah pekerja, `N` proyek berjalan, `X` lokasi, populasi tiap strata, `z = 1,96`, `e = 0,05`, `p = 0,5`, partisipasi minimum 0,30.

```
wawancara minimum manajemen dan staf = ceilSafe(0,6 x akar(M))
wawancara minimum pekerja operasional = ceilSafe(1,2 x akar(M))
Slovin                                = ceilSafe(M / (1 + M x e^2))
Cochran awal                          = z^2 x p x (1 - p) / e^2
Cochran terkoreksi                    = ceilSafe(n0 / (1 + (n0 - 1) / M))
rekomendasi survei                    = max(Slovin, Cochran terkoreksi)
proyek dikunjungi virtual             = max(1, ceilSafe(0,6 x akar(N)))
lokasi diperiksa                      = ceilSafe(akar(X))
sasaran strata s                      = min(N_s, max(ceilSafe(N_s / M x rekomendasi), ceilSafe(0,30 x N_s)))
```

Nilai yang diharapkan untuk `M = 3.000`, `N = 40`, `X = 12`: 33, 66, 353, 341, rekomendasi 353, 4 proyek, 4 lokasi, sasaran strata 5, 36, 90, 540, 230 dengan jumlah 901. Lihat `seed/fixtures/sampel-3000.json`.

Usulan pembagian validasi: wawancara individual untuk strata `MANAGEMENT` dan `SUPERVISORY`, diskusi kelompok untuk strata `SUPERVISORY` dan `FIELD`, maksimal 8 peserta per sesi.

## 8. Statistik mutu data

**Kesepakatan dalam kelompok, satu butir** (James, Demaree, dan Wolf, 1984):

```
rwg = 1 - (s^2 / sigmaEU^2),   sigmaEU^2 = (A^2 - 1) / 12 = 2,0 untuk A = 5
nilai negatif dijadikan 0
```

**Banyak butir** (J butir dalam satu dimensi):

```
rwg(J) = J x (1 - rataS^2 / sigmaEU^2) / [ J x (1 - rataS^2 / sigmaEU^2) + rataS^2 / sigmaEU^2 ]
```

Varians memakai pembagi `n - 1`. Ambang 0,70. Bila di bawah ambang, agregasi ke tingkat organisasi diberi catatan dan hasil per unit ditampilkan.

**Alfa Cronbach** per dimensi iklim, setelah butir negatif dibalik (`6 - nilai`):

```
alfa = (k / (k - 1)) x (1 - jumlah(varians butir) / varians skor total)
```

Ambang 0,70 (Nunnally dan Bernstein, 1994).

**Tanda mutu jawaban** (ditandai otomatis, dikeluarkan hanya setelah ditinjau asesor):

| Tanda | Aturan |
|---|---|
| `POLA_SERAGAM` | 90 persen atau lebih jawaban skala iklim bernilai sama |
| `TERLALU_CEPAT` | durasi kurang dari 0,33 kali median durasi asesmen |
| `BANYAK_TIDAK_TAHU` | lebih dari 50 persen jawaban karakteristik "Tidak tahu" |

Durasi tepat tidak pernah disimpan (docs/02 bagian 4). `TERLALU_CEPAT` dihitung saat jawaban dikirim: durasi tepat dari peramban dibandingkan dengan median asesmen yang ditaksir dari titik tengah rentang durasi jawaban yang sudah masuk (2,5; 7,5; 12,5; 17,5; dan 25 menit untuk rentang di atas 20 menit). Sebelum ada 10 jawaban, median memakai durasi nominal 15 menit.

## 9. Bentuk keluaran mesin (TypeScript)

```ts
type Flag = 'SELISIH_PERSEPSI_BUKTI' | 'LAPISAN_TIDAK_LENGKAP' | 'SEMUA_LAPISAN_KOSONG'
  | 'PENILAI_TUNGGAL' | 'PERLU_REKONSILIASI';

interface CharacteristicResult {
  code: string; aspectCode: string; isContextual: boolean;
  perception: number | null; evidence: number | null; validation: number | null;
  combined: number | null; divergence: number | null; final: number | null;
  panelAdjusted: number | null; flags: Flag[];
}

interface EngineResult {
  engineVersion: string;
  characteristics: CharacteristicResult[];
  aspects: Record<string, { index: number; min: number; weight: number; gapToTarget: number }>;
  organization: {
    index: number; indicativeLevel: 1 | 2 | 3 | 4 | 5; consolidated: boolean;
    minAspectIndex: number; minCharacteristicIndex: number; gapToTarget: number;
    priorityAspect: string; contextualIndex: number | null;
  };
  sclTrack?: { steps: Record<2 | 3 | 4 | 5, { weightedAverage: number; minimum: number; passed: boolean }>; indicativeLevel: 1 | 2 | 3 | 4 | 5 };
}
```

## 10. Fixture yang wajib lulus

| Berkas | Menguji |
|---|---|
| `skoring-simulasi.json` | 18 karakteristik, agregasi aspek, indeks organisasi 3,143463, tingkat 3, mantap, aspek prioritas A1, indeks kontekstual 3,165, jalur setara SCL tingkat 3 |
| `sampel-3000.json` | Seluruh kalkulator sampel |
| `kasus-tepi.json` | Contoh perhitungan pada paparan (2,92 menjadi 2,40), selisih tepat 1,00, selisih 0,99, bukti lebih tinggi, validasi kosong, batas tingkat 5, pembulatan floating point, persepsi berbobot populasi strata dengan dan tanpa penilaian mandiri, rwg, alfa Cronbach |

Untuk membuat ulang fixture: `cd seed/fixtures && python3 referensi_skoring.py`.
