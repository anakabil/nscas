# NSCAS: Nusa Safety Culture Assessment System

Aplikasi web milik PT Nusa Rendra Jayatama (Nusa Safety) untuk mengukur tingkat kematangan budaya keselamatan dan kesehatan kerja (K3). Hasilnya adalah pengukuran dan diagnosis internal, bukan sertifikat Safety Culture Ladder.

Versi 2 dibangun dengan Laravel 13, React 19 (melalui Inertia), dan PostgreSQL 16. Status pembangunan dan rencana fase ada di `PROMPTS.md`. Aturan proyek ada di `CLAUDE.md`.

## Mencoba tanpa memasang apa pun

Buka repositori ini di GitHub Codespaces (tombol Code, tab Codespaces). Aplikasi, basis data, dan akun contoh disiapkan otomatis. Panduan dan batasannya ada di `docs/09-uji-coba-codespaces.md`. Lingkungan ini hanya untuk data contoh, bukan data pekerja sungguhan.

## Menjalankan di komputer pengembang

Prasyarat: PHP 8.3 dengan ekstensi `pdo_pgsql` dan `intl`, Composer, Node.js 22, Docker.

```bash
docker compose up -d                 # PostgreSQL, MinIO, Mailpit
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan nscas:create-admin nama@perusahaan.co.id
composer run dev
```

Untuk meninjau tampilan dengan data contoh (hanya di luar produksi):

```bash
php artisan nscas:demo
```

## Pengujian

```bash
php artisan test          # memerlukan basis data PostgreSQL nscas_laravel_test
npm run types:check
npm run check
```

## Dokumen

| Dokumen | Isi |
|---|---|
| `docs/01-kebutuhan-produk.md` | Peran, modul, alur asesmen |
| `docs/02-arsitektur-dan-data.md` | Arsitektur, model data, desain anonimitas |
| `docs/03-aturan-penilaian.md` | Rumus penilaian dan kalkulator sampel |
| `docs/04-privasi-keamanan.md` | Hak akses, lokasi data, retensi |
| `docs/05-panduan-tampilan.md` | Tema, huruf, aturan bahasa |
| `docs/08-penempatan.md` | Penempatan di DigitalOcean |
| `docs/09-uji-coba-codespaces.md` | Uji coba di GitHub Codespaces (data contoh saja) |
| `docs/11-kebutuhan-aset-visual.md` | Logo, ikon, ilustrasi |
| `docs/12-kajian-metode.md` | Enam tahap penilaian dan dasar teorinya |

Implementasi versi 1 (Next.js) tersimpan di riwayat Git pada komit `8ad6b3d`.
