# 07. Hasil Uji Menyeluruh dengan Data Demo

Dokumen ini merangkum uji Fase 15 pada 24 Oktober 2026: data demo berskala klien pertama, uji end-to-end satu siklus penuh, uji beban 300 pengisian survei bersamaan, temuan, dan perbaikannya. Seluruh uji memakai basis data terpisah (`nscas_demo`, `nscas_load`, `nscas_e2e`, `nscas_test`), bukan basis data pengembangan atau produksi.

## 1. Ringkasan

| Butir uji | Sasaran | Hasil | Status |
|---|---|---|---|
| Data demo | 12 unit, 40 proyek, 3.000 responden, 900 respons, penilaian mandiri, bukti, dua asesor, sesi validasi | Lengkap dalam sekitar 48 detik, sampai status Penyusunan rencana aksi | Terpenuhi |
| Impor daftar responden (docs/01 M2) | 3.000 baris di bawah 30 detik | 1,4 sampai 1,6 detik | Terpenuhi |
| Uji end-to-end satu siklus | Draf sampai Dilaporkan melalui antarmuka | 6 dari 6 langkah lulus, seluruh transisi tercatat di jejak audit | Terpenuhi |
| Kapasitas (docs/01 bagian 5) | 300 pengisian bersamaan tanpa penurunan berarti | p95 halaman 56 ms (garis dasar 47 ms), p95 kiriman 68 ms (garis dasar 65 ms), 0 galat | Terpenuhi |
| Kinerja survei (docs/01 bagian 5) | Halaman pertama tampil di bawah 3 detik pada jaringan 3G | Median 2,48 detik pada profil 3G Chromium | Terpenuhi, margin sekitar 0,5 detik |
| Lonjakan ekstrem (di luar sasaran) | 300 pembukaan halaman pada detik yang sama | Sebelum perbaikan 10,7 persen kiriman gagal; sesudah perbaikan 0 galat, p95 halaman 15,3 detik (satu proses) dan 5,1 detik (tiga proses) | Diperbaiki; sisa dicatat untuk Fase 16 |

Seluruh rangkaian tes setelah perbaikan: `npm run lint` dan `npm run typecheck` bersih, 510 tes unit, 156 tes integrasi, dan 61 tes end-to-end lulus.

## 2. Lingkungan uji

| Komponen | Spesifikasi |
|---|---|
| Mesin | 4 vCPU Intel Xeon 2,8 GHz, RAM 16 GB, satu mesin untuk aplikasi, basis data, MinIO, dan k6 |
| Aplikasi | Build produksi Next.js 15.5.28 (`next start`), Node.js 22, satu proses kecuali disebut lain |
| Basis data | PostgreSQL 16 lokal, `DATABASE_POOL_MAX` 20 per proses |
| Alat beban | k6 v1.3.0 (`tests/load/survey.js`) |
| Peramban | Chromium headless (Playwright) |

Karena k6, aplikasi, dan basis data berbagi empat inti yang sama, angka pada uji lonjakan merupakan batas bawah. Server produksi dengan basis data terpisah akan memberi hasil sama atau lebih baik.

## 3. Data demo

Skrip `scripts/demo.ts` mengisi organisasi demo PT Contoh Konstruksi dengan satu asesmen penuh. Setiap langkah memakai fungsi layanan aplikasi yang sama dengan antarmuka, bukan sisipan langsung ke tabel. Dengan begitu aturan status, snapshot parameter terkunci, enkripsi kontak, dan jejak audit berlaku seperti pemakaian nyata. Hak akses tiap langkah diperiksa dengan `authorizeAssessmentAccess`, yang setara dengan `requireRole`.

```bash
DEMO_PASSWORD='kata-sandi-panjang' npm run demo                          # sampai Penyusunan rencana aksi
npm run demo -- --stop-at PANEL_REVIEW                                    # berhenti sebelum rapat panel
npm run demo -- --stop-at DATA_COLLECTION --tokens-out .demo/tokens.json  # survei terbuka, untuk uji beban
```

Isi yang dihasilkan:

| Komponen | Jumlah dan keterangan |
|---|---|
| Unit | 12 lokasi (1 kantor pusat, 11 kantor wilayah) dan 40 proyek berkoordinat |
| Responden | 3.000 orang fiktif, sesuai populasi strata `seed/fixtures/sampel-3000.json` (S1 15, S2 120, S3 300, S4 1.800, S5 765); kontak terenkripsi, domain surel `.test` |
| Respons survei | 900 respons sesuai sasaran kalkulator (S1 5, S2 36, S3 90, S4 539, S5 230); 33 respons bertanda mutu |
| Penilaian mandiri | 6 orang (direksi, kepala divisi K3, manajer proyek); 5 terkirim, 1 draf |
| Bukti contoh | 36 berkas PDF sah: 24 tingkat organisasi dan 12 tingkat proyek, dipetakan ke 18 karakteristik |
| Validasi daring | 47 sesi dari usulan kalkulator (wawancara, diskusi kelompok terarah, kunjungan virtual), sekitar 7 persen dibatalkan, narasumber dan nilai asesor |
| Penilaian asesor | Dua asesor menilai 18 karakteristik; K5.1 sengaja berbeda 1,5 poin agar tanda perbedaan asesor tampil |
| Hasil | Indeks organisasi 3,00, tingkat indikatif 3 (Kalkulatif), jalur setara tingkat 2, satu penyesuaian panel, 18 butir daftar kesenjangan |

Model jawaban berbenih (`scripts/demo/model.ts`). Kematangan laten setiap responden terdiri atas rata-rata unit, selisih strata, dan variasi individu. Selisih strata dipasang lebih tinggi pada manajemen agar kesenjangan persepsi manajemen dan lapangan dapat diperagakan. Selisih ini adalah asumsi model demo, bukan temuan. Simpangan baku komponen dikalibrasi dengan fungsi statistik aplikasi itu sendiri, sehingga statistik mutu data berada di rentang yang lazim:

| Statistik mutu | Ambang aplikasi | Hasil demo |
|---|---|---|
| Alfa Cronbach per dimensi iklim | 0,70 (Nunnally & Bernstein, 1994) | 0,78 sampai 0,81 |
| Kesepakatan dalam unit, rata-rata rwg(J) | 0,70 (James et al., 1984; LeBreton & Senter, 2008) | 0,77 sampai 0,93 pada 41 unit |

Dengan benih yang sama, dua kali menjalankan demo menghasilkan indeks organisasi yang identik (3,0034).

## 4. Uji end-to-end satu siklus penuh

Berkas `tests/e2e/full-cycle.spec.ts` menjalankan satu asesmen untuk organisasi PT Siklus Konstruksi melalui antarmuka, dengan tiga pengguna berverifikasi dua langkah:

1. Asesor utama membuat asesmen, menambah unit, mengisi populasi strata, menyimpan kalkulator sampel, menandai perjanjian pemrosesan data, menugaskan asesor, lalu mengubah status ke Terkonfigurasi dan Parameter dikunci.
2. Administrator klien mengatur jendela survei, mengimpor 6 responden, dan menerbitkan tautan. Tombol mulai pengumpulan data tidak tampil baginya. Asesor utama lalu mengubah status ke Pengumpulan data.
3. Lima responden mengisi survei lengkap pada tampilan telepon 360 piksel.
4. Dua asesor menilai bukti untuk 18 karakteristik.
5. Administrator klien menutup survei. Asesor utama mengubah status ke Penilaian, menjalankan mesin, mengubah status ke Rapat panel asesor, menetapkan hasil, lalu mengubah status ke Penyusunan rencana aksi.
6. Asesor utama menyusun versi laporan, menandatanganinya, lalu mengubah status ke Dilaporkan.

Hasil akhir yang diperiksa:

- Jejak audit memuat tujuh transisi status beserta pembuatan asesmen, impor, penerbitan token, eksekusi mesin, penetapan panel, dan laporan.
- Tidak ada satu pun catatan audit per jawaban survei, sesuai desain anonimitas docs/02.
- Administrator klien melihat dasbor final tanpa pita draf.

Seluruh langkah lulus. Waktu alur sekitar 80 detik.

## 5. Uji beban

### 5.1 Metode

Skrip `tests/load/survey.js` menjalankan alur responden di sisi server. Setiap pengguna virtual memakai token berbeda dan melakukan tiga permintaan:

1. Membuka halaman survei (`GET /s/[token]`).
2. Menandai tautan dibuka (`POST /s/[token]/open`).
3. Setelah waktu pengisian, mengirim jawaban lengkap untuk 18 karakteristik dan 21 butir iklim (`POST /s/[token]/submit`).

Skenario garis dasar menjalankan satu pengguna lima kali berurutan sebagai pembanding. Dua profil beban dipakai:

| Profil | Pola | Makna |
|---|---|---|
| Realistis | 300 pengguna mulai dalam rentang 60 detik dan mengisi selama 2 sampai 4 menit | Sekitar 300 pengisian berjalan bersamaan, sesuai sasaran docs/01 bagian 5 |
| Lonjakan | 300 pengguna membuka halaman pada detik yang sama dan mengirim dalam jendela sekitar satu detik | Jauh lebih berat daripada pola nyata; dipakai untuk melihat batas sistem |

Basis data uji berisi 3.000 responden dan 900 respons yang sudah masuk, sehingga kiriman berlangsung di atas data berukuran nyata. Batas laju rute survei dilonggarkan selama uji karena seluruh permintaan berasal dari satu alamat IP mesin uji. Ambang kelulusan: tidak ada galat, dan p95 halaman serta p95 kiriman masing-masing di bawah 2 detik.

### 5.2 Hasil

Waktu tanggapan dalam milidetik. p95 adalah persentil ke-95.

| No | Uji | Proses aplikasi | Halaman median | Halaman p95 | Kiriman median | Kiriman p95 | Kiriman gagal |
|---|---|---|---|---|---|---|---|
| 1 | Lonjakan, sebelum perbaikan | 1 | 12.522 | 15.896 | 1.181 | 2.492 | 32 dari 300 (10,7 persen) |
| 2 | Lonjakan, sesudah perbaikan | 1 | 7.971 | 15.275 | 1.464 | 2.383 | 0 |
| 3 | Lonjakan, sesudah perbaikan | 3 | 3.228 | 5.087 | 2.441 | 3.012 | 0 |
| 4 | Realistis, sesudah perbaikan | 1 | 26 | 56 | 48 | 68 | 0 |
| | Garis dasar satu pengguna (uji 4) | 1 | 26 | 47 | 53 | 65 | 0 |

Pada uji 4, puncak pemakaian prosesor aplikasi sekitar 82 persen dari satu inti, PostgreSQL sekitar 27 persen, dan memori proses aplikasi 493 MB.

### 5.3 Analisis

Profil realistis memenuhi sasaran "300 pengisian bersamaan tanpa penurunan berarti". Dibandingkan garis dasar satu pengguna, p95 halaman hanya naik 9 milidetik dan p95 kiriman 3 milidetik, tanpa satu galat pun.

Uji lonjakan pertama mengungkap dua temuan.

Temuan pertama: 32 kiriman gagal dengan galat Prisma P2028, artinya transaksi tidak dapat dimulai dalam batas waktu. Ada tiga penyebab:

- Kumpulan koneksi bawaan hanya 10.
- Setiap kiriman menahan koneksi selama memuat struktur instrumen, memvalidasi jawaban, dan menghitung median durasi seluruh respons.
- Batas tunggu transaksi bawaan hanya 2 detik.

Kegagalan semacam ini tidak dapat diterima, karena pekerja yang sudah selesai mengisi akan menerima pesan galat. Perbaikannya diuraikan di bagian 6. Setelah perbaikan, uji 2 dan 3 tidak mencatat galat.

Temuan kedua: halaman survei melambat pada lonjakan. Satu halaman membutuhkan sekitar 28 milidetik waktu prosesor setelah perbaikan (sebelumnya sekitar 40 milidetik). Render server Next.js berjalan di satu inti per proses, sehingga 300 permintaan pada detik yang sama mengantre sekitar 8 sampai 15 detik. Menjalankan tiga proses aplikasi menurunkan p95 halaman dari 15,3 menjadi 5,1 detik. Pola lonjakan seperti ini mungkin terjadi bila seluruh pekerja satu proyek memindai kode QR pada waktu yang sama, misalnya setelah pertemuan keselamatan pagi. Karena itu, penempatan produksi di Fase 16 memakai lebih dari satu proses aplikasi di belakang penyeimbang beban.

### 5.4 Halaman pertama pada jaringan 3G

Pengukuran memakai Chromium dengan emulasi jaringan. Waktu dihitung dari navigasi sampai tombol pilihan bahasa di layar persetujuan tampil, dengan peramban tanpa cache dan tampilan 360 piksel. Setiap profil diukur lima kali.

| Profil jaringan (preset DevTools Chromium) | Unduh, unggah, latensi | Median tampil | Transfer |
|---|---|---|---|
| 3G | 1,44 Mbps, 675 kbps, 562,5 ms | 2,48 detik | 168,2 KB |
| Slow 3G (pembanding) | 400 kbps, 400 kbps, 2.000 ms | 7,97 detik | 168,2 KB |

Sasaran di bawah 3 detik pada 3G terpenuhi dengan margin sekitar 0,5 detik. Tes `tests/e2e/survey.spec.ts` menjaga muatan halaman survei di bawah 350 KB terkompresi. Penambahan pustaka pada halaman survei perlu dihindari agar margin ini tidak habis.

## 6. Temuan dan perbaikan

| Kode | Temuan | Penyebab | Perbaikan | Bukti |
|---|---|---|---|---|
| U1 | 10,7 persen kiriman survei gagal pada lonjakan 300 kiriman | Kumpulan koneksi 10, transaksi kiriman menahan koneksi terlalu lama, batas tunggu 2 detik | Ukuran kumpulan dapat diatur (`DATABASE_POOL_MAX`, bawaan 20). Struktur instrumen disimpan di cache proses. Validasi jawaban dan tanda mutu dihitung sebelum transaksi; transaksi hanya mengunci token dan menulis. Batas tunggu transaksi kiriman 15 detik | Uji 2 dan 3 tanpa galat; tes integrasi survei lulus |
| U2 | Halaman survei lambat pada lonjakan | Render server terikat prosesor dan berjalan di satu inti per proses; kueri instrumen pada setiap pembukaan | Isi instrumen disimpan di cache proses (40 menjadi 28 ms per halaman). Rekomendasi beberapa proses aplikasi untuk Fase 16 | Uji 3; tes unit `instrument-cache.test.ts` |
| U3 | Skrip demo hanya mengimpor 2.963 dari 3.000 responden | Galat di skrip demo, bukan di aplikasi: pembagian sisa terbesar menghitung ulang sisa di setiap putaran | Fungsi `allocateByWeight` dengan tes unit | `tests/unit/demo-model.test.ts` |
| U4 | Alfa Cronbach data demo 0,57 sampai 0,62 | Model jawaban demo terlalu bising | Kalibrasi simpangan baku dengan fungsi statistik aplikasi | Alfa 0,78 sampai 0,81 |
| U5 | Skrip demo kedua di basis data yang sama ditolak saat koordinator mengunggah bukti | Cakupan unit koordinator tidak diperbarui untuk proyek asesmen baru | Cakupan digabung dan perubahannya dicatat di jejak audit | Demo kedua lulus sampai Penyusunan rencana aksi |

Cache instrumen aman dipakai karena survei baru terbuka setelah asesmen dikunci. Versi instrumen yang sudah dipakai asesmen juga tidak dapat diubah (CLAUDE.md aturan 5 dan `prisma/seeding.ts`). Cache tetap diberi batas umur 5 menit.

## 7. Rekomendasi untuk Fase 16

1. Jalankan sedikitnya tiga proses aplikasi di belakang Caddy dengan kebijakan `least_conn` selama jendela survei, ditambah satu proses worker.
2. Atur `max_connections` PostgreSQL lebih besar dari jumlah proses aplikasi dikali `DATABASE_POOL_MAX`, ditambah koneksi worker dan pg-boss. Contoh: tiga proses × 20 + worker 20 + pg-boss 10 = 90, dengan `max_connections` 150.
3. Pembatas laju disimpan per proses (docs/06, R3 dan R4). Dengan tiga proses, batas efektif per hash IP menjadi tiga kali nilai `SURVEY_RATE_LIMIT_PER_MINUTE`, dan nilai itu perlu diatur dengan memperhitungkan hal ini.
4. Ulangi kedua profil k6 di lingkungan pra-produksi dengan mesin uji terpisah sebelum survei pertama klien dibuka.

## 8. Cara mengulang

```bash
# Basis data uji terpisah, misalnya nscas_load, sudah dimigrasi dan di-seed
DATABASE_URL=postgresql://.../nscas_load DEMO_PASSWORD='...' npm run demo -- --stop-at DATA_COLLECTION --tokens-out .demo/tokens.json
npm run build
DATABASE_URL=postgresql://.../nscas_load SURVEY_RATE_LIMIT_PER_MINUTE=100000 npx next start -p 3300
k6 run -e BASE_URL=http://localhost:3300 -e PROFILE=realistic tests/load/survey.js
k6 run -e BASE_URL=http://localhost:3300 -e PROFILE=burst -e TOKEN_START=305 tests/load/survey.js
# Beberapa proses: -e BASE_URLS=http://localhost:3300,http://localhost:3301,http://localhost:3302
```

Setiap pengulangan memakai 305 token. Geser `TOKEN_START` agar token yang sudah terkirim tidak dipakai lagi.

## Rujukan

James, L. R., Demaree, R. G., & Wolf, G. (1984). Estimating within-group interrater reliability with and without response bias. *Journal of Applied Psychology, 69*(1), 85–98. https://doi.org/10.1037/0021-9010.69.1.85

LeBreton, J. M., & Senter, J. L. (2008). Answers to 20 questions about interrater reliability and interrater agreement. *Organizational Research Methods, 11*(4), 815–852. https://doi.org/10.1177/1094428106296642

Nunnally, J. C., & Bernstein, I. H. (1994). *Psychometric theory* (3rd ed.). McGraw-Hill.
