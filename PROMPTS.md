# Rencana Fase Rombak NSCAS Versi 2

Satu fase dikerjakan per sesi. Setiap fase dimulai dengan rencana singkat, lalu pengerjaan, pengujian, dan laporan: apa yang selesai, apa yang belum, dan keputusan yang perlu dikonfirmasi.

Cara membangun ulang sebuah modul:

1. Baca kebutuhan modul di `docs/01` dan tahapnya di `docs/12`.
2. Baca implementasi versi 1 di riwayat Git: `git show 8ad6b3d:<path>`. Aturan bisnis, teks antarmuka (`messages/id.json`, `messages/en.json`), dan kasus uji dibawa ke Laravel, bukan dikarang ulang.
3. Tulis aturan bisnis sebagai kode murni di `app/Domain/` dengan tes unit, lalu model, layanan, pengendali, dan halaman React.
4. Setel `ready: true` pada modul di `App\Domain\Navigation\ModuleCatalog` setelah halamannya berfungsi, dan ganti tanda fase di menu.
5. Penuhi definisi selesai di `CLAUDE.md`.

## Ringkasan fase

| Fase | Isi | Tahap penilaian | Status |
|---|---|---|---|
| R0 | Fondasi: Laravel, autentikasi, peran, isolasi tenant, jejak audit, alur enam tahap, mesin penilaian, beranda, tema, logo, paket penempatan | Semua | Selesai |
| R1 | Administrasi dan konfigurasi asesmen, dasbor progres di beranda | 1 | Selesai |
| R2 | Responden, undangan, kode QR, partisipasi | 2 | Berikutnya |
| R3 | Survei responden | 2 | |
| R4 | Penilaian mandiri manajemen | 2 | |
| R5 | Bukti dokumen dan observasi lapangan | 2 | |
| R6 | Mutu data, temuan awal, wawancara dan diskusi kelompok | 3 | |
| R7 | Penilaian asesor dan rapat panel | 4 | |
| R8 | Dasbor hasil, perbandingan antarperiode, analisis kepekaan | 5 dan 6 | |
| R9 | Kesenjangan, rencana aksi, pemantauan | 5 dan 6 | |
| R10 | Laporan dan komunikasi hasil | 5 | |
| R11 | Privasi, retensi, jejak audit, pemeriksaan keamanan | Lintas tahap | |
| R12 | Uji menyeluruh, uji beban, penempatan produksi | Lintas tahap | |

## R0. Fondasi (selesai)

Hasil: kerangka Laravel 13 dengan Inertia React; masuk dan verifikasi dua langkah tanpa pendaftaran publik; peran dan matriks hak akses (`app/Domain/Access`); alur enam tahap dan dua belas status (`app/Domain/Workflow`); katalog modul dan penyusun menu (`app/Domain/Navigation`); mesin penilaian, kalkulator sampel, dan statistik mutu data (`app/Domain/Scoring`) yang lolos seluruh fixture; penjaga akses asesmen dan jejak audit hanya-tambah; beranda dengan menu menurut tahap dan menurut jenis akun; tema Monokrom Perak dan Emas; logo; paket penempatan DigitalOcean.

## R1. Administrasi dan konfigurasi asesmen (selesai)

Hasil: organisasi dan pengguna (kata sandi sementara yang wajib diganti, peran dipilih secara eksplisit, akun dinonaktifkan bukan dihapus); asesmen baru oleh asesor utama; tujuh halaman tahap 1 (rincian, unit bertingkat dengan koordinat proyek, strata dan jumlah pekerja, parameter dengan teks persetujuan yang menyebut lokasi data dan status perjanjian pemrosesan data, kalkulator sampel di server, tim asesor paling sedikit dua orang, komunikasi awal dan kalibrasi asesor); pemeriksa syarat dan tombol ubah status DRAFT ke CONFIGURED ke LOCKED dengan snapshot parameter; perubahan setelah terkunci ditolak 409; bahasa antarmuka tersimpan di akun; dasbor progres pengukuran di beranda untuk pengelola sistem, asesor, dan administrator klien (keputusan pemilik proyek, 19 November 2026), diperbarui otomatis setiap 60 detik. Tes: `tests/Unit/Domain/Setup`, `tests/Unit/Domain/ProgressCalculatorTest.php`, `tests/Feature/Setup`.

Rujukan versi 1: `src/app/(console)/orgs`, `src/app/(console)/assessments/new`, `src/app/(console)/assessments/[id]/setup`, `src/lib/assessments`, `prisma/schema.prisma`, `prisma/seeding.ts`.

1. Organisasi dan pengguna: pengelola sistem membuat organisasi dan akun; administrator klien mengelola akun klien di organisasinya. Peran tidak boleh terisi otomatis. Akun dinonaktifkan, bukan dihapus.
2. Asesmen baru oleh asesor utama, yang otomatis menjadi asesor utama asesmen itu.
3. Halaman tahap 1: rincian dan lingkup, unit (bertingkat, dengan koordinat proyek), strata dan populasinya, parameter (bobot, ambang, teks persetujuan, status perjanjian pemrosesan data), kalkulator sampel (memakai `SampleCalculator`), tim asesor, dan komunikasi awal (catatan komitmen pimpinan, penjelasan kepada pekerja, kalibrasi asesor).
4. Muat seed instrumen dan parameter ke basis data. Saat dikunci, salin parameter ke `parameter_snapshot`.
5. Layanan transisi status yang memeriksa syarat `Workflow::transitions()` untuk DRAFT ke CONFIGURED ke LOCKED, mencatat jejak audit, dan menampilkan syarat yang belum terpenuhi beserta tautan ke halamannya.
6. Pilihan bahasa pengguna disimpan di akun.

Selesai bila: seorang asesor utama dapat membuat asesmen dari nol sampai terkunci; parameter tidak dapat diubah setelah terkunci (tes); peran lain ditolak sesuai matriks (tes).

## Dasbor progres beranda (lintas fase)

Dasbor dibangun pada fase R1 dengan ukuran tahap perencanaan, kesiapan menuju status berikutnya, jadwal, dan penanda perhatian (`App\Domain\Progress`, `App\Http\Presenters\ProgressPresenter`). Setiap fase berikutnya menambah ukurannya sendiri ke dasbor dan mengisi pemeriksaan syarat transisinya di `App\Domain\Setup\ConditionEvaluator`:

| Fase | Ukuran yang ditambahkan |
|---|---|
| R2 | Responden terdaftar dan tautan terbit; partisipasi per strata dibanding sasaran kalkulator sampel; penanda strata di bawah 30 persen |
| R3 | Survei masuk per hari; angka per unit diperbarui per jam dan disembunyikan bila kurang dari 5 orang (aturan 3) |
| R4 | Penilaian mandiri manajemen yang selesai |
| R5 | Dokumen bukti per tema; proyek yang sudah diobservasi dibanding sasaran |
| R6 | Wawancara dan diskusi kelompok terarah dibanding sasaran; status mutu data |
| R7 | Sub-tema yang sudah dinilai dua asesor; rapat panel |
| R9 | Rencana aksi berjalan dan yang melewati tenggat |

## R2. Responden, undangan, kode QR, dan partisipasi

Rujukan versi 1: `src/lib/respondents`, `src/app/(console)/assessments/[id]/respondents`, `participation`, `src/lib/jobs/invitations.ts`, `reminders.ts`, `src/app/q`.

1. Impor daftar responden dari Excel dengan validasi; jendela survei; token akses yang hanya disimpan sebagai hash.
2. Undangan dan pengingat lewat antrean; kepala surel sebagai gambar inline, tanpa gambar jarak jauh.
3. Kode QR per unit dan strata untuk pekerja tanpa surel, dengan batas pakai.
4. Partisipasi per unit dan strata dengan penyembunyian sel di bawah 5; koordinator unit hanya melihat unitnya.
5. Transisi LOCKED ke DATA_COLLECTION.
6. Daftar responden mencakup semua orang yang bekerja di bawah tanggung jawab organisasi: pekerja sendiri, alih daya, harian, dan subkontraktor. Jumlah pekerja `M` untuk kalkulator sampel memakai rata-rata setahun (`docs/13` bagian 3.5 dan V14).

## R3. Survei responden

Rujukan versi 1: `src/app/s/[token]`, `src/lib/survey`, `docs/arsip-v1/02` bagian 4.

1. Halaman survei untuk telepon: bahasa, persetujuan, strata, pernyataan berjenjang, skala iklim, tinjauan, kirim.
2. Desain anonimitas sesuai `docs/02` bagian 4, dengan tes yang membuktikan jawaban tidak dapat dihubungkan ke token.
3. Draf di perangkat, kirim ulang otomatis saat sambungan kembali, pembatas laju dengan hash alamat IP berumur pendek.
4. Halaman survei tidak memuat kode konsol; muatan di bawah 350 KB (tes).
5. Teks persetujuan memakai `config('nscas.data_location')`.

## R4. Penilaian mandiri manajemen

Rujukan versi 1: `src/app/sa/[token]`, `src/lib/self-assessment`.

Formulir bertoken yang teridentifikasi (diberitahukan di layar), pilihan pernyataan berjenjang dengan alasan wajib, simpan per karakteristik, kirim sekali.

## R5. Bukti dokumen dan observasi lapangan

Rujukan versi 1: `src/lib/evidence`, `src/lib/observations`, `src/app/o`, `src/lib/files`.

1. Unggah langsung ke penyimpanan objek dengan URL bertanda tangan; pemeriksaan jenis berkas dari isi berkas; versi dan hash SHA-256.
2. Pemetaan bukti ke karakteristik dan butir daftar periksa.
3. Jendela observasi per proyek; pengambilan foto dan video dari kamera di dalam aplikasi; waktu dari server; lokasi dan akurasinya; unggahan di luar radius ditandai.

## R6. Mutu data, temuan awal, wawancara dan diskusi kelompok

Rujukan versi 1: `src/lib/validation`, `src/app/(console)/assessments/[id]/validation`, `dashboard/quality`, `src/lib/survey/rules.ts`. Dasar: `docs/12` temuan T1, T3, T4.

1. Mutu data: partisipasi terhadap sasaran, kesepakatan dalam kelompok, alfa Cronbach, pola jawaban seragam, waktu pengisian (`DataQuality`).
2. Temuan awal: gambaran deskriptif per aspek dan strata tanpa tingkat, serta selisih persepsi manajemen dan lapangan.
3. Rencana validasi yang diturunkan dari temuan awal; sesi wawancara dan diskusi kelompok terarah (paling banyak 8 peserta); panduan dari `seed/panduan-validasi-v1.json`; nilai per karakteristik per asesor.
4. Transisi DATA_COLLECTION ke VALIDATION ke SCORING dengan gerbang mutu data.

## R7. Penilaian asesor dan rapat panel

Rujukan versi 1: `src/lib/assessor-scoring`, `src/app/(console)/assessments/[id]/scoring`, `panel`.

1. Nilai bukti per karakteristik oleh dua asesor (kelipatan 0,5), tanda rekonsiliasi.
2. Menjalankan `ScoringEngine` dan menyimpan hasil sebagai catatan perhitungan beserta versi mesin dan parameter.
3. Rapat panel: penyesuaian dengan alasan tertulis, penguncian hasil.

## R8. Dasbor hasil, perbandingan antarperiode, analisis kepekaan

Rujukan versi 1: `src/lib/dashboard`, `src/app/(console)/assessments/[id]/dashboard`.

Kartu indeks dan tingkat dengan lencana, grafik aspek dan karakteristik, peta warna dengan penyembunyian sel, ekspor Excel, perbandingan antarperiode, dan analisis kepekaan bobot lapisan (`docs/12` bagian 6). Pernyataan "bukan sertifikat" wajib tampil.

## R9. Kesenjangan, rencana aksi, dan pemantauan

Rujukan versi 1: `src/lib/action-plans`, `src/app/(console)/assessments/[id]/gaps`.

Daftar kesenjangan dari hasil, analisis akar masalah, rencana aksi dengan penanggung jawab dan tenggat, pengingat tenggat, pemantauan triwulan.

## R10. Laporan dan komunikasi hasil

Rujukan versi 1: `src/lib/report`, `src/lib/jobs/report-render.ts`.

Laporan lengkap, ringkasan eksekutif, dan pernyataan hasil dalam HTML siap cetak dan PDF; penomoran versi; tanda tangan asesor utama; parameter penilaian di lampiran. Ringkasan hasil untuk pekerja (`docs/12` temuan T5).

## R11. Privasi, retensi, jejak audit, dan pemeriksaan keamanan

Rujukan versi 1: `src/lib/retention`, `src/lib/jobs/destruction.ts`, `src/lib/audit-trail`, `docs/arsip-v1/06`.

Halaman jejak audit, pemusnahan data mentah dengan berita acara, pengingat retensi, batas waktu sesi untuk peran Nusa Safety, daftar periksa keamanan baru, dan pemasangan kembali analisis statis PHP (Larastan).

## R12. Uji menyeluruh dan penempatan produksi

1. Uji ujung ke ujung dengan Playwright untuk satu siklus penuh dari DRAFT sampai MONITORING.
2. Uji beban 300 pengisian survei bersamaan.
3. Penempatan di DigitalOcean sesuai `docs/08`, setelah syarat lokasi data di `docs/04` terpenuhi.
