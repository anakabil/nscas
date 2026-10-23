# Urutan Prompt Pembangunan NSCAS

Salin satu blok prompt ke Claude Code, tunggu sampai selesai, periksa hasilnya dengan daftar "Cara memeriksa", lakukan komit, jalankan `/clear`, lalu lanjut ke fase berikutnya. Jangan menggabungkan beberapa fase dalam satu sesi.

Fase 0 sampai 6 menghasilkan versi yang sudah dapat dipakai uji coba survei. Fase 7 sampai 13 melengkapi penilaian asesor, hasil, dan laporan. Fase 14 sampai 16 menyiapkan produksi.

---

## Fase 0. Persiapan proyek

```
Baca CLAUDE.md dan seluruh berkas di docs/ serta seed/. Setelah itu:

1. Buat proyek Next.js 15 dengan TypeScript strict, App Router, Tailwind CSS, ESLint, dan folder src/. Pasang Prisma, Zod, next-intl, Auth.js v5, shadcn/ui, lucide-react, Recharts, pg-boss, Vitest, dan Playwright.
2. Buat docker-compose.yml berisi PostgreSQL 16, MinIO, dan Mailpit untuk pengembangan, beserta .env.example sesuai docs/02 bagian 8.
3. Siapkan struktur folder sesuai docs/02 bagian 2, termasuk messages/id.json dan messages/en.json.
4. Buat skrip npm: dev, build, lint, typecheck, test, test:e2e, db:migrate, db:seed.
5. Pasang Plus Jakarta Sans melalui next/font dan token warna dari docs/05 di konfigurasi Tailwind.
6. Buat halaman /health yang memeriksa koneksi basis data dan penyimpanan objek.
7. Pindahkan berkas logo dari folder aset-logo/ ke public/brand/ dengan nama logo-long-color.png, logo-short-color.png, dan logo-short-white.png.
8. Inisialisasi git dengan .gitignore yang mengabaikan .env.

Mulai dengan menyampaikan rencana singkat. Di akhir, jalankan lint, typecheck, dan test, lalu laporkan hasilnya.
```

**Cara memeriksa:** `docker compose up -d`, `npm run dev`, buka `http://localhost:3000/health` dan pastikan semua berstatus baik.

---

## Fase 1. Mesin penilaian dan kalkulator sampel

```
Kerjakan src/lib/scoring/ sesuai docs/03 sebagai modul TypeScript murni tanpa impor Prisma, Next.js, atau I/O.

1. types.ts: tipe masukan dan keluaran sesuai docs/03 bagian 9.
2. engine.ts: perception, combineLayers, scoreCharacteristic, aggregate, indicativeLevel, consolidation, sclTrack, perceptionGap. Terapkan EPS dan ceilSafe sesuai docs/03 bagian 1.
3. sampling.ts: kalkulator sampel sesuai docs/03 bagian 7.
4. quality.ts: rwg satu butir, rwg(J), alfa Cronbach dengan pembalikan butir negatif, dan tanda mutu jawaban.
5. __tests__/fixtures.test.ts: muat ketiga berkas JSON di seed/fixtures/ dan bandingkan setiap nilai dengan toleransi 1e-6. Tambahkan tes untuk rwg(J) dan tanda mutu dengan nilai yang dihitung tangan, sertakan perhitungannya di komentar.

Fixture adalah sumber kebenaran. Bila hasil berbeda, perbaiki kode, jangan ubah fixture. Rujukan Python ada di seed/fixtures/referensi_skoring.py. Laporkan cakupan tes modul ini; sasaran minimal 95 persen baris.
```

**Cara memeriksa:** `npm test` lulus semua. Minta Claude Code menampilkan nilai indeks organisasi hasil fixture simulasi; harus 3,143463 dan tingkat 3.

---

## Fase 2. Skema basis data dan data awal

```
Buat prisma/schema.prisma sesuai model data di docs/02 bagian 3, lengkap dengan relasi, indeks, dan enum.

1. Pastikan SurveyResponse tidak memiliki relasi ke AccessToken maupun RosterEntry, sesuai docs/02 bagian 4.
2. Buat migrasi SQL tambahan berisi pemicu PostgreSQL yang menolak UPDATE dan DELETE pada tabel AuditLog.
3. Tulis prisma/seed.ts yang memuat seed/aspek-dan-parameter.json, seed/instrumen-karakteristik-v1.json, dan seed/skala-iklim-draf.json sebagai InstrumentVersion NS-SCML-1.0 berstatus PUBLISHED. Seed harus idempoten.
4. Seed juga membuat satu pengguna SUPER_ADMIN dari variabel lingkungan SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD, serta organisasi demo "PT Contoh Konstruksi" tanpa data responden.
5. Tulis tes integrasi yang membuktikan pemicu AuditLog bekerja dan bahwa seed menghasilkan 7 aspek, 18 karakteristik, 90 pernyataan berjenjang, dan 21 butir skala iklim.
```

**Cara memeriksa:** `npm run db:migrate && npm run db:seed`, lalu `npx prisma studio` untuk melihat isi tabel.

---

## Fase 3. Autentikasi, hak akses, dan jejak audit

```
Kerjakan autentikasi dan otorisasi sesuai docs/04 bagian 2 sampai 4 dan 6.

1. Auth.js v5 dengan kredensial, argon2id, penguncian akun, dan TOTP wajib untuk peran yang disebut di docs/04 bagian 3, termasuk alur aktivasi dengan kode QR dan 10 kode cadangan.
2. src/lib/auth/guard.ts berisi requireRole(assessmentId, allowedRoles, { unitId }) yang memeriksa keanggotaan organisasi, penugasan asesmen, dan cakupan unit. Semua Server Action dan Route Handler wajib memakainya.
3. src/lib/audit.ts berisi fungsi logAudit yang dipanggil dalam transaksi yang sama dengan perubahan data.
4. src/lib/privacy/crypto.ts untuk enkripsi AES-256-GCM kolom *Enc.
5. Halaman masuk, verifikasi dua faktor, pengaturan akun, dan manajemen pengguna untuk SUPER_ADMIN dan CLIENT_ADMIN.
6. Header keamanan dan pembatas laju sesuai docs/04 bagian 5.
7. Tes e2e: pengguna organisasi A tidak dapat membaca asesmen organisasi B; koordinator unit tidak dapat membaca unit lain; SUPER_ADMIN tidak dapat membuka daftar responden.
```

**Cara memeriksa:** masuk sebagai admin seed, aktifkan TOTP dengan aplikasi autentikator di telepon, lalu keluar dan masuk lagi.

---

## Fase 4. Administrasi dan konfigurasi asesmen

```
Kerjakan modul M1 di docs/01 dan mesin status di docs/01 bagian 3.

1. Halaman daftar organisasi dan asesmen; formulir asesmen baru (lingkup, periode, tingkat sasaran, versi instrumen).
2. Pengelolaan unit bertingkat, termasuk koordinat dan radius untuk unit berjenis PROJECT.
3. Pengelolaan strata dengan lima strata bawaan dari seed dan isian populasi.
4. Halaman parameter yang menampilkan bobot lapisan, bobot penilaian mandiri, ambang, dan teks persetujuan; dapat diubah selama belum dikunci.
5. Kalkulator sampel interaktif memakai src/lib/scoring/sampling.ts, menampilkan hasil seperti lembar 09 pada kertas kerja Excel.
6. Tombol Kunci yang menyalin parameter ke Assessment.parameterSnapshot. Setelah dikunci, perubahan ditolak dengan kode 409 dan formulir menjadi baca saja.
7. Penugasan lead assessor dan asesor ke asesmen.
8. Setiap transisi status diperiksa syaratnya dan dicatat di jejak audit.

Semua teks antarmuka dalam bahasa Indonesia baku sesuai docs/05 bagian 4, lengkap dengan terjemahan Inggris.
```

**Cara memeriksa:** buat asesmen untuk organisasi demo dengan 3.000 pekerja; kalkulator harus menampilkan 33, 66, 353, 341, dan sasaran 901.

---

## Fase 5. Manajemen responden dan partisipasi

```
Kerjakan modul M2 di docs/01.

1. Impor Excel dan CSV daftar responden dengan pratinjau, galat per baris, dan pemetaan nama unit serta strata. Sediakan templat Excel yang dapat diunduh.
2. Penerbitan token sesuai docs/04 bagian 3; simpan hanya hash. Tampilkan tautan sekali saja saat diterbitkan, serta ekspor CSV tautan untuk distribusi oleh koordinator.
3. Kode QR per unit untuk pekerja penyedia jasa tanpa surel, beserta halaman cetak berukuran A4.
4. Pengiriman surel undangan dan pengingat terjadwal melalui pg-boss sesuai docs/02 bagian 6, maksimal tiga pengingat.
5. Pencabutan dan penerbitan ulang token.
6. Dasbor partisipasi per strata dan per unit, dengan penanda strata di bawah 30 persen.
7. Tes kinerja: impor 3.000 baris harus selesai di bawah 30 detik.

Ingat aturan anonimitas: partisipasi dihitung dari AccessToken.completedAt, bukan dari SurveyResponse.
```

**Cara memeriksa:** impor berkas contoh 50 responden, kirim undangan, lalu buka Mailpit di `http://localhost:8025`.

---

## Fase 6. Survei responden

```
Kerjakan modul M3 di docs/01, desain anonimitas di docs/02 bagian 4, dan panduan halaman survei di docs/05 bagian 3. Ini halaman yang paling banyak dipakai; utamakan keringanan dan kemudahan.

1. Rute /s/[token]: validasi token, layar persetujuan dengan teks dari parameterSnapshot, pilihan bahasa.
2. Bagian A: satu karakteristik per layar, lima pernyataan dalam urutan acak yang tetap untuk satu responden, tanpa nomor tingkat, ditambah pilihan Tidak tahu.
3. Bagian B: butir skala iklim Likert lima titik.
4. Draf jawaban hanya di IndexedDB perangkat. Pengiriman sekali di akhir, diulang otomatis bila gagal karena sambungan.
5. Pengiriman dalam satu transaksi sesuai docs/02 bagian 4: tandai token selesai, buat SurveyResponse tanpa rujukan ke token, simpan tanggal tanpa jam dan durasi dalam rentang.
6. Hitung dan simpan tanda mutu jawaban sesuai docs/03 bagian 8.
7. Pastikan rute /s/* tidak mencatat alamat IP atau isi permintaan di log, dan memakai Referrer-Policy no-referrer.
8. Tes e2e di viewport 360 piksel: isi survei, putuskan jaringan di tengah, sambungkan kembali, kirim, lalu pastikan token tidak dapat dipakai lagi.
9. Tes yang membuktikan tidak ada kolom di SurveyResponse yang dapat dipakai untuk menemukan token atau responden.
10. Ukur muatan halaman; sasaran di bawah 350 KB terkompresi.
```

**Cara memeriksa:** buka tautan survei di telepon genggam sendiri, isi sampai selesai, coba mode pesawat di tengah pengisian.

---

## Fase 7. Penilaian mandiri manajemen

```
Kerjakan modul M4 di docs/01 pada rute /sa/[token].

1. Pemberitahuan di awal bahwa penilaian mandiri teridentifikasi dan alasannya.
2. Per karakteristik: pilih satu pernyataan berjenjang, alasan wajib minimal 50 karakter, dan tautan ke bukti yang sudah diunggah di M5 (boleh dikosongkan bila bukti belum ada, tetapi diberi peringatan).
3. Draf tersimpan di server; status SUBMITTED mengunci jawaban.
4. Daftar penerbitan token penilaian mandiri di konsol klien.
```

---

## Fase 8. Penyimpanan bukti dan observasi digital

```
Kerjakan modul M5 dan M6 di docs/01 serta penyimpanan berkas di docs/02 bagian 5.

1. Unggah langsung ke penyimpanan objek dengan URL bertanda tangan; verifikasi ukuran, jenis berdasarkan isi berkas, dan hash SHA-256 setelah unggah.
2. Pemetaan bukti ke karakteristik, penomoran versi, dan daftar periksa bukti per karakteristik dari seed. Tampilkan karakteristik yang belum memiliki minimal dua jenis bukti.
3. Jendela observasi per proyek oleh asesor: waktu buka, waktu tutup, daftar periksa, koordinat dan radius.
4. Rute /o/[windowId] untuk koordinator: ambil foto atau video langsung dari kamera perangkat, minta izin lokasi, catat akurasi. Waktu dicatat server. Tolak di luar jendela waktu; tandai bila di luar radius. Jangan izinkan pilih dari galeri.
5. Jadikan rute observasi dapat dipasang sebagai PWA.
6. Unduhan selalu melalui route handler dengan pemeriksaan hak akses.
```

---

## Fase 9. Validasi daring

```
Kerjakan modul M7 di docs/01.

1. Penjadwalan sesi WAWANCARA, DISKUSI_KELOMPOK, dan KUNJUNGAN_VIRTUAL dengan tautan rapat eksternal.
2. Usulan pembagian sesi otomatis dari hasil kalkulator sampel: wawancara untuk strata MANAGEMENT dan SUPERVISORY, diskusi kelompok untuk SUPERVISORY dan FIELD, maksimal 8 peserta per sesi.
3. Templat panduan pertanyaan per lapisan jabatan yang dapat diubah lead assessor. Sertakan satu contoh pertanyaan validasi per karakteristik; untuk K5.1 gunakan: "Ceritakan laporan terakhir yang Anda buat atau terima. Apa tindak lanjutnya, dan berapa lama?"
4. Formulir asesor per sesi: nilai 1,0 sampai 5,0 kelipatan 0,5 untuk karakteristik yang dibahas, catatan, dan persetujuan perekaman.
5. Daftar narasumber disimpan terpisah dari catatan.
```

---

## Fase 10. Penilaian asesor dan rapat panel

```
Kerjakan modul M8 di docs/01.

1. Layar penilaian bukti per karakteristik untuk setiap asesor: lima pernyataan berjenjang sebagai acuan, daftar bukti dan observasi terkait, nilai 1,0 sampai 5,0 kelipatan 0,5, dan alasan wajib. Asesor tidak melihat nilai asesor lain sebelum menyimpan nilainya sendiri.
2. Masukan jalur setara Safety Culture Ladder: persentase pemenuhan per aspek per tingkat dengan alasan.
3. Layanan yang mengumpulkan data dari basis data menjadi masukan mesin (lapisan persepsi berbobot populasi strata, bukti, validasi), menjalankan src/lib/scoring, dan menyimpan ScoreRun.
4. Halaman rapat panel: matriks triangulasi per karakteristik (persepsi, bukti, validasi, gabungan, akhir, tanda), daftar tanda PERLU_REKONSILIASI dan SELISIH_PERSEPSI_BUKTI, penyesuaian nilai dengan alasan wajib, lalu finalisasi.
5. Setelah final, ScoreRun dan penyesuaian tidak dapat diubah.
6. Tes integrasi: data asesmen demo yang disusun agar masukan mesinnya sama dengan seed/fixtures/skoring-simulasi.json harus menghasilkan indeks organisasi 3,143463.
```

---

## Fase 11. Analitik dan dasbor

```
Kerjakan modul M9 di docs/01 dengan Recharts dan token warna di docs/05.

1. Kartu ringkasan, grafik indeks per aspek terhadap sasaran, grafik per karakteristik.
2. Peta warna aspek terhadap strata dan aspek terhadap unit, dengan src/lib/privacy/suppression.ts untuk sel di bawah 5 responden.
3. Daftar tanda selisih persepsi dan bukti, kesenjangan persepsi manajemen dan pelaksana.
4. Panel mutu data: partisipasi, alfa Cronbach per dimensi, rwg per unit, jawaban bertanda beserta tombol keluarkan dan pulihkan dengan alasan (hanya asesor, tercatat di audit).
5. Pembandingan antarperiode bila tersedia.
6. Tampilan EXECUTIVE_VIEWER hanya ringkasan dan grafik, setelah hasil final.
7. Tes yang membuktikan tidak ada titik data di dasbor maupun ekspor yang berasal dari kurang dari 5 respons.
```

---

## Fase 12. Daftar kesenjangan dan rencana aksi

```
Kerjakan modul M10 di docs/01.

1. Pembentukan daftar kesenjangan otomatis dari ScoreRun final, diurutkan menurut bobot aspek dikali kesenjangan.
2. Isian analisis penyebab dan prioritas.
3. Tindakan dengan penanggung jawab, tenggat, indikator keberhasilan, dan status; pembaruan kemajuan dan verifikasi asesor.
4. Tampilan pemantauan triwulanan dan pengingat tenggat melalui surel.
5. Ekspor daftar kesenjangan dan rencana aksi ke Excel.
```

---

## Fase 13. Pelaporan

```
Kerjakan modul M11 di docs/01 dengan struktur laporan di docs/01 bagian 6.

1. Halaman laporan HTML yang rapi dicetak A4, memakai identitas Nusa Safety dari docs/05 dan logo di public/brand/.
2. Ekspor PDF di server dengan Playwright Chromium melalui tugas pg-boss report.render.
3. Ringkasan eksekutif dan pernyataan hasil sebagai dokumen terpisah.
4. Pernyataan kedudukan hasil dari docs/01 bagian 1 wajib tampil di ketiga dokumen.
5. Versi laporan; finalisasi dengan tanda tangan lead assessor (nama, jabatan, waktu) yang mengunci laporan.
6. Lampiran daftar narasumber, daftar bukti, dan parameter terkunci.
```

---

## Fase 14. Privasi, keamanan, dan retensi

```
Lakukan pemeriksaan menyeluruh terhadap docs/04 dan lengkapi yang belum ada.

1. Telusuri seluruh rute dan pastikan setiap akses data melalui requireRole. Laporkan rute yang tidak memakainya.
2. Tugas retention.scan, alur pemusnahan oleh SUPER_ADMIN, dan berita acara PDF di DestructionRecord.
3. Ekspor jejak audit ke CSV untuk lead assessor.
4. Jalankan npm audit dan perbaiki kerentanan tingkat tinggi.
5. Buat daftar periksa keamanan di docs/06-daftar-periksa-keamanan.md berisi hasil setiap butir docs/04.
```

---

## Fase 15. Uji menyeluruh dengan data demo

```
1. Buat skrip scripts/demo.ts yang mengisi organisasi demo dengan 12 unit, 40 proyek, 3.000 responden fiktif, 900 respons survei acak yang realistis, penilaian mandiri, bukti contoh, nilai dua asesor, dan sesi validasi.
2. Tes e2e satu siklus penuh dari DRAFT sampai REPORTED.
3. Uji beban dengan k6: 300 pengisian survei bersamaan. Laporkan waktu tanggapan persentil 95.
4. Perbaiki semua temuan, lalu tulis ringkasan hasil uji di docs/07-hasil-uji.md.
```

---

## Fase 16. Penempatan produksi

```
Siapkan penempatan produksi sesuai docs/02 bagian 7.

1. Dockerfile bertahap untuk aplikasi dan worker pg-boss (image sama, perintah berbeda).
2. docker-compose.prod.yml berisi aplikasi, worker, PostgreSQL dengan volume persisten, MinIO, dan Caddy.
3. Caddyfile untuk nscas.nusasafety.co.id dengan TLS otomatis dan header keamanan.
4. Skrip cadangan harian pg_dump terenkripsi ke penyimpanan objek kedua, simpan 30 hari, dan skrip uji pemulihan.
5. Panduan penempatan langkah demi langkah di docs/08-penempatan.md untuk VPS Ubuntu 24.04 di pusat data Indonesia, termasuk pengaturan firewall, pengguna non-root, dan pembaruan otomatis keamanan.

Jangan menjalankan perintah apa pun ke server produksi. Cukup siapkan berkas dan panduan.
```
