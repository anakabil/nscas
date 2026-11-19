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

### 3.1 Tabel yang sudah ada (fase R0)

| Tabel | Isi | Catatan |
|---|---|---|
| `users` | Akun, hash kata sandi, rahasia verifikasi dua langkah (terenkripsi), `is_super_admin`, `is_active` | Akun dinonaktifkan, bukan dihapus |
| `organizations` | Nusa Safety (`is_operator`) dan organisasi klien | Kunci ULID |
| `memberships` | Peran pengguna di satu organisasi | Peran operator hanya sah di organisasi operator |
| `assessments` | Organisasi, nama, periode, sasaran tingkat, status, versi instrumen, `parameter_snapshot`, `locked_at` | Kunci ULID; status mengikuti `AssessmentStatus` |
| `assessment_team_members` | Asesor utama dan asesor per asesmen | Akses asesor hanya ke asesmen yang ditugaskan |
| `audit_logs` | Waktu, pelaku, peran, organisasi, asesmen, aksi, entitas, perubahan, hash alamat IP | Hanya-tambah; pemicu menolak UPDATE, DELETE, TRUNCATE |
| `sessions`, `cache`, `jobs` | Sesi, cache, antrean | Membuat server aplikasi tanpa keadaan |

### 3.2 Tabel yang dibangun pada fase berikutnya

Nama dan kolom mengikuti model versi 1 (`git show 8ad6b3d:prisma/schema.prisma`), dengan nama gaya Laravel.

| Fase | Tabel |
|---|---|
| R1 | `units`, `strata`, `instrument_versions`, `aspects`, `characteristics`, `statements`, `kickoff_records` |
| R2 | `roster_entries`, `access_tokens`, `survey_windows`, `qr_codes`, `participation_snapshots` |
| R3 | `survey_responses`, `survey_answers` |
| R4 | `self_assessments`, `self_assessment_answers` |
| R5 | `evidence_items`, `evidence_versions`, `observation_windows`, `observations` |
| R6 | `validation_sessions`, `validation_ratings`, `validation_plans` |
| R7 | `evidence_ratings`, `score_runs`, `panel_adjustments` |
| R9 | `gaps`, `action_items`, `monitoring_reviews` |
| R10 | `reports` |
| R11 | `destruction_records` |

## 4. Desain anonimitas survei

Tujuan: tidak seorang pun, termasuk Nusa Safety, dapat mengetahui jawaban seorang responden tertentu. Rancangan ini dibawa utuh dari versi 1 dan wajib dibuktikan dengan tes pada fase R3.

1. Token mentah hanya ada di tautan. Basis data menyimpan hash token.
2. Saat survei dikirim, dalam satu transaksi: token ditandai selesai, dan jawaban baru dibuat dengan unit dan strata yang disalin dari token, tanpa kolom apa pun yang merujuk token atau daftar responden.
3. Jawaban hanya menyimpan tanggal kirim tanpa jam, dan durasi dalam rentang, agar tidak dapat dicocokkan dengan waktu selesai token.
4. Waktu selesai, waktu buka pertama, dan waktu persetujuan pada token dibulatkan ke jam. Pengiriman survei tidak menulis jejak audit.
5. Alamat IP tidak disimpan untuk rute survei. Pembatas laju memakai hash alamat IP berumur pendek di memori.
6. Draf jawaban hanya disimpan di perangkat responden, bukan di server.
7. Unit dengan kurang dari 5 respons digabungkan ke unit induknya pada setiap tampilan dan ekspor.
8. Log aplikasi dan log server web tidak mencatat isi permintaan maupun alamat lengkap rute survei.

Penilaian mandiri, observasi, dan validasi tidak anonim karena memerlukan pertanggungjawaban. Hal ini dinyatakan di layar masing-masing.

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

## 6. Variabel lingkungan

Daftar lengkap ada di `.env.example` (pengembangan) dan `deploy/digitalocean/.env.production.example` (produksi). Yang khusus NSCAS:

| Variabel | Arti |
|---|---|
| `NSCAS_ENFORCE_TWO_FACTOR` | Mewajibkan verifikasi dua langkah untuk peran tertentu. Wajib `true` di produksi |
| `NSCAS_DATA_LOCATION` | Lokasi pusat data pada teks persetujuan responden. Produksi: `Singapura` |
| `TRUSTED_PROXIES` | Alamat penyeimbang beban atau proksi yang dipercaya |
