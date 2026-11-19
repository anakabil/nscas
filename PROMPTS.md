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
| R2 | Responden, undangan, kode QR, partisipasi | 2 | Selesai |
| R3 | Survei responden | 2 | Selesai |
| R4 | Penilaian mandiri manajemen | 2 | Selesai |
| R5 | Bukti dokumen dan observasi lapangan | 2 | Selesai |
| R6 | Mutu data, temuan awal, wawancara dan diskusi kelompok | 3 | Selesai |
| R7 | Penilaian asesor dan rapat panel | 4 | Selesai |
| R8 | Dasbor hasil, perbandingan antarperiode, analisis kepekaan | 5 dan 6 | Selesai |
| R9 | Kesenjangan, rencana aksi, pemantauan | 5 dan 6 | Berikutnya |
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
| R2 (selesai) | Responden terdaftar dan token terbit; survei selesai dibanding sasaran kalkulator sampel; jumlah strata di bawah ambang partisipasi minimum |
| R3 (selesai) | Survei selesai dihitung dari token secara langsung pada dasbor dan halaman Partisipasi, per unit dan strata, dengan jumlah di bawah ambang sel disembunyikan; tren harian dari cuplikan pukul 23.00 WIB |
| R4 (selesai) | Penilaian mandiri terkirim dibanding yang diterbitkan |
| R5 (selesai) | Karakteristik yang memenuhi ambang jenis bukti dibanding seluruh karakteristik; proyek yang sudah memiliki rekaman observasi dibanding seluruh proyek |
| R6 | Wawancara dan diskusi kelompok terarah dibanding sasaran; status mutu data |
| R7 | Sub-tema yang sudah dinilai dua asesor; rapat panel |
| R9 | Rencana aksi berjalan dan yang melewati tenggat |

## Keputusan pemilik proyek

Pemilik proyek menyetujui seluruh rekomendasi Trustie pada 19 November 2026. Keputusan yang sudah berlaku di kode tidak diubah; yang belum, dikerjakan pada fase yang disebut.

| Asal | Keputusan | Berlaku di |
|---|---|---|
| R0 | Model enam tahap dengan status Validasi; satu Droplet sebagai awal, dapat diperbesar | Sudah berlaku |
| R1 | Tim asesor paling sedikit dua orang; penguncian setelah perjanjian pemrosesan data ditandatangani; akun baru dengan kata sandi sementara; unit dan tim tetap dapat diubah setelah dikunci | Sudah berlaku |
| R2 | Tautan, undangan, dan kode QR hanya diterbitkan administrator klien; kode QR boleh untuk satu strata; token yang sudah selesai tidak dapat dicabut atau diterbitkan ulang | Sudah berlaku |
| R3 | Skala iklim tetap draf sampai ditelaah ahli dan diuji coba; batas laju 600 pembukaan dan 300 kiriman per menit; urutan pernyataan acak tanpa nomor tingkat | Sudah berlaku; telaah ahli di bagian Tugas di luar fase |
| R3 | Trustie menyusun draf terjemahan Inggris isi instrumen untuk ditelaah | Tugas di luar fase |
| R5 | Syarat `evidence_reviewed` berupa pernyataan tinjauan asesor per karakteristik; hitungan dua jenis bukti hanya penanda | Sudah berlaku (R6) |
| R5 | Asesor tetap hanya membaca bukti; dokumen yang diterima saat wawancara diunggah administrator klien dan dicatat pada catatan sesi | Sudah berlaku (matriks `docs/04`) |
| R5 | Aplikasi web yang dapat dipasang (PWA) untuk halaman kamera observasi | R12 |
| `docs/13` | D1 instrumen versi 2 berstruktur 5 tema dan 20 subtema, dengan instrumen versi 1 sebagai jembatan; D5 kode dan judul subtema SCL 2.0 di seed tanpa teks kriteria | Tugas di luar fase, sebelum R7 |
| `docs/13` | D2 aturan penetapan tingkat per tema; D3 ambang 0,80 dan 0,50 sebagai awal; D4 fixture versi 2 | Sudah berlaku sebagai aturan murni dan fixture (R7); dipakai mesin setelah instrumen versi 2 (D1) selesai ditelaah |
| `docs/13` | D6 paling sedikit satu kunjungan proyek fisik setiap asesmen | Sudah berlaku (R6) |
| R4 | Tautan penilaian mandiri tetap diterbitkan administrator klien, dapat dikirim lewat surel Hostinger; syarat `self_assessments_submitted` (paling sedikit satu terkirim, tidak ada tautan aktif yang belum dikirim) | Sudah berlaku (R6) |
| Bahasa | "Peninjau eksekutif"; "masa survei" dan "masa observasi" menggantikan "jendela"; "Pengaturan lengkap" | Sudah berlaku (`docs/05` butir 6 dan 8) |
| Lokasi data | Persetujuan atas lokasi Singapura tetap sesuai rencana awal: rumusan diserahkan kepada klien untuk dibaca dan disetujui | `docs/04` bagian 1.1 |

## Tugas di luar fase

| Tugas | Penanggung jawab | Status |
|---|---|---|
| Telaah ahli dan uji coba skala iklim bagian B (21 butir draf; proposal menjanjikan 90 sampai 120 butir) | Nusa Safety, dibantu Trustie | Belum |
| Draf terjemahan Inggris isi instrumen versi 1 (nama karakteristik, pernyataan berjenjang, butir iklim) untuk ditelaah | Trustie, ditelaah Nusa Safety | Belum |
| Draf instrumen versi 2 (D1) dan peta silang kode subtema SCL 2.0 (D5) untuk ditelaah ahli | Trustie, ditelaah Nusa Safety | Belum; diperlukan sebelum R7 |
| Rumusan adendum atau klausul perjanjian pemrosesan data tentang lokasi Singapura, untuk dibaca dan disetujui klien | Nusa Safety | Belum |
| Pembukaan blokir port SMTP DigitalOcean; bucket Spaces dan aturan CORS (`docs/08` bagian 9 dan 9a) | Administrator server | Belum |

## R2. Responden, undangan, kode QR, dan partisipasi (selesai)

Hasil: impor daftar responden dari .xlsx atau CSV dengan pratinjau, galat per baris, dan penyimpanan hanya bila seluruh baris valid (templat Excel dengan daftar pilihan unit dan strata); kontak responden terenkripsi; tautan survei yang ditampilkan sekali dan diunduh sebagai CSV, dengan hanya hash token tersimpan; undangan surel lewat antrean yang membuat token saat surel dikirim dan mencabutnya bila pengiriman gagal; pengingat pukul 08.00 WIB paling banyak tiga kali dengan jarak tiga hari, dengan rotasi token yang belum dibuka; pencabutan dan penerbitan ulang; kode QR per unit dan strata dengan batas penerbitan, pemakaian ulang token pada perangkat yang sama, dan lembar A4 siap cetak; masa survei dalam WIB; penugasan koordinator unit dengan cakupan unit di bawahnya; partisipasi per strata dan unit dengan ambang sel serta penanda strata di bawah ambang, dan cuplikan harian pukul 23.00 WIB; halaman publik `/q` dan `/s` tanpa sesi sehingga alamat IP responden tidak tersimpan (formulir survei menyusul di R3); syarat `roster_imported` dan `tokens_issued` untuk LOCKED ke DATA_COLLECTION; dasbor beranda menampilkan survei selesai terhadap sasaran. Surel memakai Hostinger Mail `admin@nusasafety.co.id` (keputusan pemilik proyek, fase R2; `docs/08` bagian 9, `docs/04` bagian 1.2). Tes: `tests/Unit/Domain/Respondents`, `tests/Feature/Respondents`, termasuk impor 3.000 baris di bawah 30 detik.


Rujukan versi 1: `src/lib/respondents`, `src/app/(console)/assessments/[id]/respondents`, `participation`, `src/lib/jobs/invitations.ts`, `reminders.ts`, `src/app/q`.

1. Impor daftar responden dari Excel dengan validasi; masa survei; token akses yang hanya disimpan sebagai hash.
2. Undangan dan pengingat lewat antrean; kepala surel sebagai gambar inline, tanpa gambar jarak jauh.
3. Kode QR per unit dan strata untuk pekerja tanpa surel, dengan batas pakai.
4. Partisipasi per unit dan strata dengan penyembunyian sel di bawah 5; koordinator unit hanya melihat unitnya.
5. Transisi LOCKED ke DATA_COLLECTION.
6. Daftar responden mencakup semua orang yang bekerja di bawah tanggung jawab organisasi: pekerja sendiri, alih daya, harian, dan subkontraktor. Jumlah pekerja `M` untuk kalkulator sampel memakai rata-rata setahun (`docs/13` bagian 3.5 dan V14).

## R3. Survei responden (selesai)

Hasil: tabel instrumen ternormalisasi per versi (18 karakteristik dengan 90 pernyataan berjenjang, 7 dimensi dan 21 butir skala iklim dari `seed/skala-iklim-draf.json`); tabel jawaban anonim dengan UUID versi 4 acak, tanggal kirim WIB tanpa jam, rentang durasi lima menit, dan tanpa kolom maupun kunci asing ke token atau daftar responden; halaman survei sebagai paket peramban tersendiri tanpa kode konsol (sekitar 78 KB terkompresi) dengan alur bahasa, persetujuan, strata pilihan untuk token kode QR, bagian A dengan urutan pernyataan acak tetap per responden tanpa tingkatnya, bagian B, tinjauan, dan kirim; draf di IndexedDB dan kirim ulang otomatis saat sambungan kembali; pengiriman dalam satu transaksi dengan token dikunci, waktu token dibulatkan ke jam, tanda mutu POLA_SERAGAM, TERLALU_CEPAT, BANYAK_TIDAK_TAHU, tanpa jejak audit, log, maupun alamat IP; pembatas laju dengan HMAC harian alamat IP yang hidup satu menit; pengacakan urutan fisik baris jawaban setiap malam sebelum cadangan; data contoh jawaban. Tes: `tests/Unit/Domain/Survey`, `tests/Feature/Survey` (anonimitas skema dan kode, token sekali pakai, penolakan, strata kode QR, tanda mutu, muatan di bawah 350 KB).


Rujukan versi 1: `src/app/s/[token]`, `src/lib/survey`, `docs/arsip-v1/02` bagian 4.

1. Halaman survei untuk telepon: bahasa, persetujuan, strata, pernyataan berjenjang, skala iklim, tinjauan, kirim.
2. Desain anonimitas sesuai `docs/02` bagian 4, dengan tes yang membuktikan jawaban tidak dapat dihubungkan ke token.
3. Draf di perangkat, kirim ulang otomatis saat sambungan kembali, pembatas laju dengan hash alamat IP berumur pendek.
4. Halaman survei tidak memuat kode konsol; muatan di bawah 350 KB (tes).
5. Teks persetujuan memakai `config('nscas.data_location')`.

## R4. Penilaian mandiri manajemen (selesai)

Hasil: administrator klien menerbitkan tautan penilaian mandiri per orang (nama, jabatan, unit; tautan ditampilkan sekali), mencabut, dan menerbitkan ulang tanpa kehilangan draf; asesor dan administrator klien melihat progres dan rincian jawaban. Formulir `/sa/{token}` berupa paket ringan tanpa kode konsol: pemberitahuan bahwa penilaian teridentifikasi, identitas pengisi, satu karakteristik per layar dengan pernyataan berurutan acak tanpa nomor tingkat, alasan wajib paling sedikit 50 karakter, draf disimpan di server setiap berpindah layar, pemeriksaan akhir, lalu kirim sekali dan terkunci. Setiap perubahan dicatat di jejak audit. Penautan bukti dokumen menunggu modul Bukti (R5); kolomnya sudah tersedia. Dasbor beranda menampilkan penilaian mandiri terkirim dibanding yang diterbitkan. Tes: `tests/Unit/Domain/SelfAssessment`, `tests/Feature/SelfAssessment`.


Rujukan versi 1: `src/app/sa/[token]`, `src/lib/self-assessment`.

Formulir bertoken yang teridentifikasi (diberitahukan di layar), pilihan pernyataan berjenjang dengan alasan wajib, simpan per karakteristik, kirim sekali.

## R5. Bukti dokumen dan observasi lapangan (selesai)

Hasil: bukti dokumen dengan unggah dua langkah (URL PUT bertanda tangan ke Spaces, atau penerima aplikasi pada disk lokal), pemeriksaan jenis dari isi berkas dan kesesuaian ekstensi, batas 25 MB, SHA-256, nomor versi (versi lama tetap dapat diunduh), pemetaan ke karakteristik dan butir daftar periksa dari `evidence_examples`, indikator karakteristik dengan kurang dari dua jenis bukti, hapus logis, dan cakupan unit koordinator. Observasi lapangan: masa observasi per proyek oleh asesor (waktu WIB, daftar periksa, titik dan radius), halaman kamera di dalam aplikasi tanpa isian berkas (foto dari bingkai kamera, video tanpa suara paling lama 30 detik), waktu server, lokasi dan akurasinya, penanda di luar radius, penolakan di luar masa observasi, dan galeri untuk asesor. Penilaian mandiri kini menautkan bukti per karakteristik. Unggahan yang tidak diselesaikan dihapus setiap jam. Survei dan penilaian mandiri mendapat daftar pertanyaan untuk berpindah dan mengubah jawaban, serta halaman periksa dengan tombol Ubah; petunjuk diringkas; kesamaan kunci teks dua bahasa diperiksa saat kompilasi. Seluruh halaman diperiksa otomatis pada lebar 360, 768, 1024, dan 1440 piksel tanpa luapan. Tes: `tests/Unit/Domain/{Files,Evidence,Observations}`, `tests/Feature/Evidence`, `tests/Feature/Observations`.


Rujukan versi 1: `src/lib/evidence`, `src/lib/observations`, `src/app/o`, `src/lib/files`.

1. Unggah langsung ke penyimpanan objek dengan URL bertanda tangan; pemeriksaan jenis berkas dari isi berkas; versi dan hash SHA-256.
2. Pemetaan bukti ke karakteristik dan butir daftar periksa.
3. Masa observasi per proyek; pengambilan foto dan video dari kamera di dalam aplikasi; waktu dari server; lokasi dan akurasinya; unggahan di luar radius ditandai.

## R6. Mutu data, temuan awal, wawancara dan diskusi kelompok (selesai)

Hasil: tahap 3 memiliki tiga halaman. Mutu data: partisipasi per strata dengan alasan tertulis untuk strata di bawah batas, alfa Cronbach per dimensi iklim, rwg per unit, dan jawaban bertanda yang dapat dikeluarkan dari analisis dengan alasan lalu dipulihkan (tanpa unit dan strata pada daftarnya), ditutup dengan tinjauan partisipasi dan tinjauan mutu data oleh asesor utama. Temuan awal: rata-rata berbobot jumlah pekerja strata per karakteristik dan kelompok jabatan, selisih persepsi manajemen dan pelaksana per karakteristik dan aspek, porsi "Tidak tahu", penilaian mandiri, jenis bukti, iklim per kelompok, dan usulan karakteristik fokus beserta alasannya; tanpa tingkat, dengan sel di bawah lima responden disembunyikan (`App\Domain\Findings\PreliminaryFindings`). Validasi: usulan sesi dari rencana sampel (wawancara manajemen dan operasional, diskusi kelompok terarah paling banyak delapan peserta, kunjungan proyek fisik dan daring; `App\Domain\Validation\SessionProposal`), jadwal WIB, tautan rapat HTTPS, narasumber yang disimpan terpisah dari catatan, panduan pertanyaan per kelompok jabatan dari `seed/panduan-validasi-v1.json` yang dapat diubah asesor utama, nilai 1,0 sampai 5,0 kelipatan 0,5 milik setiap asesor, persetujuan perekaman, dan catatan umpan balik harian. Asesor menandai bukti setiap karakteristik sudah ditinjau dari halaman Bukti dokumen. Tombol Tutup survei sekarang di halaman Responden, dan tautan penilaian mandiri dapat dikirim lewat surel (alamat terenkripsi, token baru dibuat saat surel dikirim). Syarat baru diperiksa otomatis: `survey_closed`, `participation_reviewed`, `self_assessments_submitted`, `data_quality_reviewed`, `validation_plan_set`, `validation_sessions_completed`, `site_visit_completed`, `evidence_reviewed`. Setiap perubahan tercatat di jejak audit. Tes: `tests/Unit/Domain/{Findings,Validation}`, `tests/Feature/Validation`; seluruh halaman baru diperiksa pada lebar 360, 768, 1024, dan 1440 piksel tanpa luapan.


Rujukan versi 1: `src/lib/validation`, `src/app/(console)/assessments/[id]/validation`, `dashboard/quality`, `src/lib/survey/rules.ts`. Dasar: `docs/12` temuan T1, T3, T4.

1. Mutu data: partisipasi terhadap sasaran, kesepakatan dalam kelompok, alfa Cronbach, pola jawaban seragam, waktu pengisian (`DataQuality`).
2. Temuan awal: gambaran deskriptif per aspek dan strata tanpa tingkat, serta selisih persepsi manajemen dan lapangan.
3. Rencana validasi yang diturunkan dari temuan awal; sesi wawancara dan diskusi kelompok terarah (paling banyak 8 peserta); panduan dari `seed/panduan-validasi-v1.json`; nilai per karakteristik per asesor.
4. Transisi DATA_COLLECTION ke VALIDATION ke SCORING dengan gerbang mutu data.
5. Syarat `evidence_reviewed`: asesor menyatakan bukti setiap karakteristik telah ditinjau; indikator dua jenis bukti dari modul Bukti tampil sebagai penanda, bukan penentu (keputusan R5).
6. Sesi kunjungan proyek fisik sebagai jenis sesi validasi; paling sedikit satu per asesmen menjadi syarat VALIDATION ke SCORING (D6).

## R7. Penilaian asesor dan rapat panel (selesai)

Hasil: setiap asesor menilai bukti setiap karakteristik (1,0 sampai 5,0 kelipatan 0,5) dengan alasan paling sedikit 20 karakter serta pilihan bukti dokumen dan rekaman observasi yang menjadi dasarnya, dalam satu ruang kerja yang memuat persepsi (survei per kelompok jabatan, penilaian mandiri, porsi "Tidak tahu"), nilai validasi per sesi, bukti, dan observasi; nilai asesor lain baru terlihat setelah asesor menyimpan nilainya sendiri, dan selisih di atas ambang ditandai perlu rekonsiliasi. Asesor utama mengisi jalur setara per aspek dan tangga dengan alasan. Perhitungan nilai dijalankan dari data basis data dan parameter terkunci, disimpan sebagai eksekusi yang tidak dapat diubah (pemicu basis data) beserta versi mesin, parameter, dan nilai lapisan tanpa jawaban mentah; halaman memberi tahu bila data masukan berubah setelah perhitungan terakhir. Rapat panel memutuskan setiap karakteristik bertanda selisih persepsi dan bukti atau perlu rekonsiliasi, dengan menyesuaikan nilai (1,00 sampai 5,00) atau mengukuhkan nilai mesin, selalu dengan alasan tertulis; hasil sesudah keputusan dihitung ulang dari masukan tersimpan, lalu ditetapkan dan dikunci. Pernyataan bahwa hasil bukan sertifikat tampil di halaman panel. Syarat `two_assessor_ratings`, `score_run_saved`, `panel_adjustments_justified`, dan `results_locked` diperiksa otomatis. Aturan penetapan tangga per tema (D2) dengan ambang 0,80 dan 0,50 (D3) tersedia sebagai kode murni `App\Domain\Scoring\ThemeLevelRule` dengan fixture versi 2 `seed/fixtures/aturan-tema-v2.json` dari `seed/fixtures/referensi_aturan_tema.py` (D4); fixture versi 1 tidak diubah. Aturan ini dipakai mesin setelah instrumen versi 2 bertema (D1, D5) selesai ditelaah, karena instrumen versi 1 tidak berstruktur tema. Tes: `tests/Unit/Scoring/ThemeLevelRuleTest.php`, `tests/Unit/Domain/Panel`, `tests/Feature/Scoring`.


Rujukan versi 1: `src/lib/assessor-scoring`, `src/app/(console)/assessments/[id]/scoring`, `panel`.

1. Nilai bukti per karakteristik oleh dua asesor (kelipatan 0,5), tanda rekonsiliasi.
2. Menjalankan `ScoringEngine` dan menyimpan hasil sebagai catatan perhitungan beserta versi mesin dan parameter.
3. Rapat panel: penyesuaian dengan alasan tertulis, penguncian hasil.
4. Aturan penetapan tingkat per tema (D2) dengan ambang 0,80 dan 0,50 (D3), dan fixture versi 2 beserta `referensi_skoring.py` (D4). Fixture versi 1 tetap untuk instrumen versi 1.

## R8. Dasbor hasil, perbandingan antarperiode, analisis kepekaan (selesai)

Hasil: dasbor hasil membaca hasil final rapat panel; asesor juga dapat melihat hasil sementara dari perhitungan terakhir dengan tanda yang jelas, sedangkan peran lain hanya melihat hasil final. Isinya kartu indeks organisasi, tingkat indikatif dan kemantapannya, selisih ke sasaran, aspek prioritas, dan tingkat jalur setara; batang indeks per aspek dan per karakteristik dengan garis sasaran; daftar karakteristik terkena aturan selisih persepsi dan bukti; selisih persepsi manajemen dan pelaksana per aspek; peta warna aspek terhadap strata dan terhadap unit dengan sel di bawah lima responden disembunyikan (koordinator unit hanya melihat unitnya); ringkasan mutu data; dan analisis kepekaan bobot lapisan (enam skenario, satu bobot naik 0,05 dan satu turun 0,05) yang menyatakan apakah tingkat berubah (`docs/12` bagian 6). Ekspor Excel memuat ringkasan, aspek, karakteristik, kedua peta warna dengan sel tetap tersembunyi, dan kepekaan, dengan pernyataan bukan sertifikat di baris pertama; setiap ekspor tercatat di jejak audit. Perbandingan antarperiode menampilkan hasil final asesmen organisasi yang sama dengan versi instrumen yang sama, yang dapat dilihat pengguna, beserta perubahan indeks organisasi dan indeks aspek. Pernyataan bukan sertifikat tampil di dasbor. Tes: `tests/Unit/Domain/Results`, `tests/Feature/Results`.


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
4. Halaman kamera observasi sebagai aplikasi web yang dapat dipasang di layar utama telepon (keputusan R5), diuji pada domain produksi dengan telepon sungguhan.
