# 02. Arsitektur dan Model Data (Versi 2)

Dokumen versi 1 (Next.js dan Prisma) ada di `docs/arsip-v1/02-arsitektur-dan-data-v1.md`. Rancangan anonimitas, penyimpanan berkas, dan model data di sana tetap menjadi rujukan saat modul dibangun ulang.

## 1. Tumpukan teknologi

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Bahasa dan kerangka server | PHP 8.3, Laravel 13 | Pengendali tipis; aturan bisnis di `app/Domain` |
| Antarmuka | React 19 dan TypeScript melalui Inertia 3 | Halaman React dirender dari rute server; tanpa API publik terpisah |
| Gaya | Tailwind CSS 4, komponen shadcn/ui | Token tema di `resources/css/app.css` |
| Basis data | PostgreSQL 16 | Juga menyimpan sesi, cache, dan antrean |
| Autentikasi | Laravel Fortify | Masuk, atur ulang kata sandi, verifikasi dua langkah (TOTP), kode pemulihan |
| Tugas latar | Antrean dan penjadwal Laravel, penggerak basis data | Undangan, pengingat, pembuatan laporan |
| Penyimpanan berkas | S3: DigitalOcean Spaces di produksi, MinIO saat pengembangan | Unggah langsung dengan URL bertanda tangan |
| Pengujian | PHPUnit pada PostgreSQL; pemeriksaan TypeScript | Uji ujung ke ujung dengan Playwright pada fase R12 |
| Penempatan | Docker di Droplet DigitalOcean wilayah `sgp1` | Lihat `docs/08` |

Mengapa Inertia, bukan React terpisah dengan API. Pertama, setiap halaman melewati penjaga akses di server, sehingga isolasi tenant tidak bergantung pada kode peramban. Kedua, sesi memakai cookie aman, sehingga tidak ada token akses yang disimpan di peramban. Ketiga, hanya ada satu unit yang dibangun dan dipasang, sehingga server aplikasi tetap tanpa keadaan dan mudah digandakan.

## 2. Struktur folder

```
app/
  Domain/                kode murni, tanpa Laravel, basis data, atau I/O
    Access/              Role, Resource, Permissions (matriks docs/04)
    Workflow/            AssessmentStatus, Stage, Workflow (docs/12)
    Navigation/          ModuleCatalog, MenuBuilder (menu per tahap dan per jenis akun)
    Scoring/             ScoringEngine, SampleCalculator, DataQuality (docs/03)
  Models/                Organization, Membership, Assessment, AssessmentTeamMember, AuditLog, User
  Support/               AssessmentAccess (penjaga akses), Audit (pencatat jejak audit)
  Http/
    Controllers/         HomeController, AssessmentController, AccountAreaController, Settings/
    Middleware/          SecurityHeaders, SetLocale, EnsureAccountIsUsable, HandleInertiaRequests
    Presenters/          bentuk data untuk antarmuka (kunci dan angka, bukan kalimat)
  Console/Commands/      nscas:create-admin, nscas:demo
resources/
  js/
    pages/               halaman Inertia: home, assessments/*, auth/*, settings/*, error
    layouts/             bingkai halaman kerja, halaman masuk, pengaturan
    components/brand/    logo NSCAS
    components/icons/    ikon tahap dan ikon halaman
    components/nscas/    kartu tahap, ubin tugas, kepala asesmen
    i18n/id, i18n/en     teks antarmuka
  css/app.css            token tema
lang/id, lang/en         pesan server dan validasi
database/migrations      skema
seed/                    instrumen, parameter, fixture (tidak bergantung kerangka)
deploy/digitalocean/     berkas penempatan
tests/Unit               domain dan mesin penilaian (tanpa Laravel)
tests/Feature            beranda, hak akses, jejak audit, autentikasi
```

## 3. Model data

### 3.1 Tabel yang sudah ada (fase R0 sampai R7)

| Tabel | Isi | Catatan |
|---|---|---|
| `users` | Akun, hash kata sandi, rahasia verifikasi dua langkah (terenkripsi), `is_super_admin`, `is_active`, `locale`, `must_change_password` | Akun dinonaktifkan, bukan dihapus. Akun dari administrator wajib mengganti kata sandi sementara (R1) |
| `organizations` | Nusa Safety (`is_operator`) dan organisasi klien, `legal_name`, `sector`, `is_active` | Kunci ULID |
| `memberships` | Peran pengguna di satu organisasi | Peran operator hanya sah di organisasi operator. Peran tidak pernah diisi otomatis |
| `instrument_versions` | Kode versi, status terbit, parameter bawaan (`default_parameters`), isi instrumen (`content`) | Dimuat dari `seed/` oleh `InstrumentVersionSeeder` (R1). Versi yang sudah ada tidak diubah |
| `assessments` | Organisasi, nama, lingkup, periode, sasaran tingkat, status, versi instrumen, `parameter_draft`, teks persetujuan dua bahasa, status perjanjian pemrosesan data, komunikasi awal (`kickoff`), kalibrasi asesor (`calibration`), `parameter_snapshot`, `locked_at`, `locked_by`, masa survei (`survey_opens_at`, `survey_closes_at`, disimpan UTC, diisi dalam WIB) | Kunci ULID; status mengikuti `AssessmentStatus`. Setelah LOCKED hanya snapshot yang dibaca (aturan 5) |
| `units` | Unit bertingkat (kantor pusat, divisi, proyek, cabang), koordinat dan radius proyek | Unit induk tidak dapat dihapus selama memiliki unit di bawahnya |
| `strata` | Kode, nama, kelompok, jumlah pekerja (rata-rata setahun), penyedia jasa | Kode unik per asesmen. Tidak dapat diubah setelah dikunci |
| `assessment_team_members` | Asesor utama dan asesor per asesmen | Akses asesor hanya ke asesmen yang ditugaskan. Paling sedikit dua orang sebelum dikunci |
| `roster_entries` | Daftar responden: unit, strata, nama, nomor induk, surel dan telepon (terenkripsi kunci aplikasi), `email_hash` (HMAC, untuk mencegah duplikat), status penyedia jasa | R2. Tidak pernah dirujuk jawaban survei (aturan 2). Impor hanya bila seluruh baris valid |
| `access_tokens` | Hash SHA-256 token survei, unit, strata (kosong untuk kode QR sampai responden memilih), kanal (EMAIL, LINK, QR), waktu terbit, buka, persetujuan, selesai, dicabut beserta alasannya, jumlah pengingat | R2. Token mentah hanya ada di tautan dan surel. Partisipasi dihitung dari `completed_at` di sini |
| `unit_qr_codes` | Kode QR per unit, strata opsional, hash kode, batas penerbitan, aktif atau tidak | R2. Kode baru untuk unit dan strata yang sama menonaktifkan kode lama |
| `unit_assignments` | Penugasan koordinator unit pada unit asesmen | R2. Cakupan koordinator: unit yang ditugaskan beserta unit di bawahnya |
| `participation_snapshots` | Jumlah mentah populasi, token, dan selesai per hari | R2. Diambil pukul 23.00 WIB; ambang sel diterapkan saat ditampilkan |
| `characteristics`, `level_statements` | Karakteristik per versi instrumen beserta lima pernyataan berjenjang (teks Indonesia, teks Inggris bila tersedia) | R3. Disalin sekali per versi dari `instrument_versions.content`; tidak diubah setelah dipakai |
| `climate_dimensions`, `climate_items` | Dimensi dan butir skala iklim, termasuk penanda butir terbalik | R3. Dari `seed/skala-iklim-draf.json` (status draf) |
| `survey_responses` | Asesmen, unit, strata, versi instrumen, bahasa, tanggal kirim (WIB, tanpa jam), rentang durasi, tanda mutu, status dikeluarkan dari analisis | R3. Anonim (aturan 2): UUID versi 4 acak, tanpa cap waktu, tanpa kolom atau kunci asing ke token dan daftar responden |
| `characteristic_answers`, `climate_answers` | Tingkat per karakteristik (kosong untuk Tidak tahu) dan nilai 1 sampai 5 per butir iklim | R3. UUID versi 4 acak; urutan fisik baris diacak setiap malam (`nscas:shuffle-survey-rows`) |
| `self_assessments` | Penilaian mandiri manajemen: asesmen, unit, token yang berlaku, nama dan jabatan pengisi, status DRAFT atau SUBMITTED, waktu kirim | R4. Teridentifikasi dan diaudit; token jenis SELF_ASSESSMENT pada `access_tokens` dapat diganti tanpa kehilangan draf |
| `self_assessment_answers` | Tingkat, alasan (paling sedikit 50 karakter saat kirim), dan id bukti per karakteristik | R4. Terkunci setelah dikirim; penautan bukti diisi sejak R5 |
| `evidence_requirements` | Butir daftar periksa bukti per karakteristik (posisi, uraian) | R5. Diisi dari `evidence_examples` versi instrumen, oleh migrasi untuk versi yang sudah dimuat dan oleh `InstrumentVersionSeeder` untuk versi baru |
| `evidence_items` | Bukti dokumen: asesmen, unit (kosong untuk tingkat organisasi), judul, keterangan, nama berkas, kunci objek, SHA-256, jenis dari isi, ukuran, nomor versi, versi yang digantikan, pengunggah, waktu hapus logis | R5. Setiap versi baris tersendiri; satu versi hanya dapat digantikan sekali; hapus logis, berkas tetap tersimpan sampai pemusnahan |
| `evidence_links` | Pemetaan bukti ke karakteristik beserta id butir daftar periksa yang dipenuhi | R5. Dasar hitungan jenis bukti per karakteristik (`EvidenceChecklist`) |
| `observation_windows` | Masa observasi per proyek: judul, waktu buka dan tutup, daftar periksa (O1, O2, dan seterusnya), titik proyek, radius toleransi, pembuat | R5. Dibuat asesor utama atau asesor |
| `observation_captures` | Foto atau video kamera: butir, kunci objek, SHA-256, jenis dari isi, ukuran, waktu server, lokasi dan akurasi, jarak ke titik proyek, penanda di luar radius, catatan, pengunggah | R5. Tidak anonim; waktu dari server, bukan dari perangkat |
| `pending_uploads` | Izin unggah yang belum diselesaikan: jenis, asesmen, pengguna, kunci objek, nama berkas, ukuran yang dinyatakan, data tambahan, waktu kedaluwarsa | R5. Id baris menjadi tiket unggah; baris dan objek yang tidak diselesaikan dihapus setiap jam oleh `nscas:prune-uploads` |
| `assessment_reviews` | Tinjauan asesor utama per jenis (PARTICIPATION, DATA_QUALITY): catatan, peninjau, waktu | R6. Satu baris per jenis; syarat `participation_reviewed` dan `data_quality_reviewed` |
| `stratum_justifications` | Alasan tertulis untuk strata yang partisipasinya di bawah batas | R6. Satu baris per strata |
| `evidence_reviews` | Pernyataan asesor bahwa bukti satu karakteristik sudah ditinjau, dengan catatan | R6. Syarat `evidence_reviewed` bila semua karakteristik ditinjau |
| `validation_guides` | Panduan pertanyaan per kelompok jabatan: pembuka dan pertanyaan per kode karakteristik | R6. Disalin dari `seed/panduan-validasi-v1.json` saat pertama dibuka; diubah asesor utama |
| `validation_sessions` | Sesi wawancara, diskusi kelompok terarah, kunjungan proyek fisik atau daring: nama, kelompok jabatan, unit, strata, jadwal, tautan rapat HTTPS, lokasi, jumlah peserta, status, karakteristik fokus, persetujuan perekaman, catatan | R6. Syarat `validation_plan_set`, `validation_sessions_completed`, `site_visit_completed` |
| `validation_participants` | Nama dan jabatan narasumber | R6. Disimpan terpisah dari catatan dan nilai; tidak masuk laporan |
| `validation_ratings` | Nilai 1,0 sampai 5,0 kelipatan 0,5 per sesi, karakteristik, dan asesor, dengan dasar penilaian | R6. Batasan basis data memeriksa rentang dan kelipatan |
| `feedback_notes` | Ringkasan umpan balik harian kepada organisasi | R6. Satu baris per tanggal |
| `evidence_ratings` | Nilai bukti per asesmen, karakteristik, dan asesor (1,0 sampai 5,0 kelipatan 0,5), alasan, id bukti dan rekaman observasi dasar | R7. Satu baris per asesor per karakteristik; nilai rekan tersembunyi sampai asesor menyimpan nilainya |
| `scl_fulfillments` | Pemenuhan jalur setara per aspek dan tangga (0 sampai 100 persen) dengan alasan | R7. Diisi asesor utama |
| `score_runs` | Eksekusi mesin: versi mesin, masukan (nilai lapisan dan hitungan, tanpa jawaban mentah), parameter terkunci, hasil, pelaksana; kolom final diisi satu kali saat penetapan | R7. Pemicu `score_run_guard` menolak perubahan masukan dan hasil, serta perubahan atau penghapusan eksekusi final; paling banyak satu eksekusi final per asesmen |
| `panel_decisions` | Keputusan panel per karakteristik: disesuaikan (nilai 1,00 sampai 5,00) atau dikukuhkan, nilai mesin, alasan, pemutus | R7. Pemicu `panel_decision_guard` menolak perubahan setelah hasil ditetapkan |
| `audit_logs` | Waktu, pelaku, peran, organisasi, asesmen, aksi, entitas, perubahan, hash alamat IP | Hanya-tambah; pemicu menolak UPDATE, DELETE, TRUNCATE |
| `sessions`, `cache`, `jobs` | Sesi, cache, antrean | Membuat server aplikasi tanpa keadaan |

Isi instrumen disimpan sebagai JSON di `instrument_versions.content` (fase R1) dan disalin ke tabel ternormalisasi pada fase R3, karena jawaban survei merujuk karakteristik dan butir iklim dengan kunci asing.

### 3.2 Tabel yang dibangun pada fase berikutnya

Nama dan kolom mengikuti model versi 1 (`git show 8ad6b3d:prisma/schema.prisma`), dengan nama gaya Laravel.

| Fase | Tabel |
|---|---|
| R9 | `gaps`, `action_items`, `monitoring_reviews` |
| R10 | `reports` |
| R11 | `destruction_records` |

## 4. Desain anonimitas survei

Tujuan: tidak seorang pun, termasuk Nusa Safety, dapat mengetahui jawaban seorang responden tertentu. Rancangan ini dibawa utuh dari versi 1 dan dibuktikan dengan tes fase R3 (`tests/Feature/Survey/SurveyAnonymityTest.php` dan `SurveySubmissionTest.php`). Urutan fisik baris jawaban di basis data juga diacak setiap malam sebelum cadangan dibuat, agar urutan pengiriman tidak dapat dicocokkan dengan waktu selesai token.

1. Token mentah hanya ada di tautan. Basis data menyimpan hash token.
2. Saat survei dikirim, dalam satu transaksi: token ditandai selesai, dan jawaban baru dibuat dengan unit dan strata yang disalin dari token, tanpa kolom apa pun yang merujuk token atau daftar responden.
3. Jawaban hanya menyimpan tanggal kirim tanpa jam, dan durasi dalam rentang, agar tidak dapat dicocokkan dengan waktu selesai token.
4. Waktu selesai, waktu buka pertama, dan waktu persetujuan pada token dibulatkan ke jam. Pengiriman survei tidak menulis jejak audit.
5. Alamat IP tidak disimpan untuk rute survei: rute itu tidak memulai sesi, tidak menulis log aplikasi, dan tidak menulis jejak audit. Pembatas laju memakai HMAC alamat IP dengan kunci aplikasi dan tanggal, sehingga tidak dapat dibalik dan berganti setiap hari; penghitungnya hanya hidup satu menit di cache aplikasi.
6. Draf jawaban hanya disimpan di perangkat responden, bukan di server.
7. Unit dengan kurang dari 5 respons digabungkan ke unit induknya pada setiap tampilan dan ekspor.
8. Log aplikasi dan log server web tidak mencatat isi permintaan maupun alamat lengkap rute survei.

Penilaian mandiri, observasi, dan validasi tidak anonim karena memerlukan pertanggungjawaban. Hal ini dinyatakan di layar masing-masing.

## 4a. Penyimpanan berkas bukti dan observasi (fase R5)

1. Kunci objek: `{organisasi}/{asesmen}/{evidence|observation}/{acak 128 bit}.{ekstensi}`. Bucket privat; tidak ada berkas yang dapat dibuka tanpa URL bertanda tangan.
2. Unggah dua langkah. Peramban meminta izin ke aplikasi (judul, unit, ukuran, nama berkas; untuk observasi juga butir dan lokasi), lalu mengirim berkas langsung ke tujuan unggah, lalu menyelesaikan dengan tiket. Dengan disk `s3` (DigitalOcean Spaces di produksi) tujuan unggah adalah URL PUT bertanda tangan 15 menit, sehingga berkas tidak melewati server aplikasi. Dengan disk `local` (Codespaces dan pengujian) tujuan unggah adalah `PUT /uploads/{tiket}` di aplikasi sendiri, dengan alur dan pemeriksaan yang sama.
3. Saat diselesaikan, server membaca objek: ukuran harus sama dengan yang dinyatakan dan paling besar 25 MB; jenis dikenali dari isi berkas (`App\Domain\Files\FileType`), bukan dari nama atau header kiriman peramban; untuk bukti, ekstensi nama berkas harus sesuai dengan jenisnya; SHA-256 dihitung dari seluruh isi. Objek yang gagal diperiksa langsung dihapus.
4. Unduhan selalu lewat aplikasi, yang memeriksa hak akses dan cakupan unit, lalu mengalihkan ke URL GET bertanda tangan lima menit (disk `s3`) atau mengirim isi berkas (disk `local`).
5. Observasi hanya menerima foto dan video dari kamera di dalam aplikasi; halaman kamera tidak memiliki isian berkas. Waktu pengambilan adalah waktu server saat izin unggah diminta. Pengambilan di luar masa observasi ditolak; di luar radius diterima tetapi ditandai.

## 5. Keamanan lapisan aplikasi

| Kendali | Letak |
|---|---|
| Kebijakan keamanan isi dengan nonce, tanpa sumber pihak ketiga; larangan bingkai; tanpa perujuk | `SecurityHeaders` |
| Peran yang mewajibkan verifikasi dua langkah harus mengaktifkannya sebelum bekerja; akun nonaktif dikeluarkan | `EnsureAccountIsUsable` |
| Isolasi tenant dan matriks hak akses | `AssessmentAccess`, `Permissions` |
| Jejak audit hanya-tambah | `Audit`, pemicu basis data |
| Pembatas laju masuk dan verifikasi dua langkah | `FortifyServiceProvider` |
| Halaman galat tanpa rincian teknis | `bootstrap/app.php` |
| Huruf dan ikon dipasang lokal | `resources/css/app.css` |
| Jenis berkas dari isi, ukuran, dan SHA-256 diperiksa server; berkas tanpa catatan dibersihkan | `UploadGrants`, `ObjectStore`, `nscas:prune-uploads` |

## 6. Variabel lingkungan

Daftar lengkap ada di `.env.example` (pengembangan) dan `deploy/digitalocean/.env.production.example` (produksi). Yang khusus NSCAS:

| Variabel | Arti |
|---|---|
| `NSCAS_ENFORCE_TWO_FACTOR` | Mewajibkan verifikasi dua langkah untuk peran tertentu. Wajib `true` di produksi |
| `NSCAS_DATA_LOCATION` | Lokasi pusat data pada teks persetujuan responden. Produksi: `Singapura` |
| `TRUSTED_PROXIES` | Alamat penyeimbang beban atau proksi yang dipercaya |
