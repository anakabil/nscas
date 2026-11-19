# NSCAS: Nusa Safety Culture Assessment System

Aplikasi web milik PT Nusa Rendra Jayatama (Nusa Safety) untuk mengukur tingkat kematangan budaya keselamatan dan kesehatan kerja (K3) secara daring, dengan kerangka acuan Safety Culture Ladder dari NEN. Klien pertama: PT Adhi Karya (Persero) Tbk., lingkup sampai 3.000 pekerja, 40 proyek, 12 lokasi.

Hasil aplikasi ini adalah **pengukuran dan diagnosis internal**, bukan sertifikat Safety Culture Ladder. Jangan pernah menulis teks antarmuka atau laporan yang menyiratkan sertifikasi NEN.

## Status: rombak versi 2

Atas keputusan pemilik proyek (19 November 2026), NSCAS dibangun ulang dengan Laravel, React, dan PostgreSQL. Implementasi versi 1 (Next.js, 16 fase selesai) dihapus dari cabang kerja dan tersimpan di riwayat Git pada komit `8ad6b3d`. Saat membangun ulang sebuah modul, baca dulu implementasi lamanya dengan `git show 8ad6b3d:<path>` (kode di `src/`, teks antarmuka di `messages/id.json` dan `messages/en.json`, tes di `tests/`): aturan bisnis dan teksnya sudah diuji dan disetujui, jadi dibawa, bukan dikarang ulang.

Fase R0 (fondasi), R1 (administrasi dan konfigurasi asesmen, dengan dasbor progres di beranda), R2 (responden, undangan, kode QR, partisipasi; surel lewat Hostinger Mail), R3 (survei responden anonim untuk telepon), R4 (penilaian mandiri manajemen), R5 (bukti dokumen dan observasi lapangan; berkas di Spaces lewat URL bertanda tangan), R6 (mutu data, temuan awal, validasi lapangan), dan R7 (penilaian asesor, perhitungan nilai, rapat panel) selesai. Fase berikutnya, keputusan pemilik proyek yang sudah diambil (termasuk D1 sampai D6, disetujui 19 November 2026), dan tugas di luar fase ada di `PROMPTS.md`.

## Baca sebelum mengerjakan apa pun

| Dokumen | Isi |
|---|---|
| `docs/01-kebutuhan-produk.md` | Peran, dua belas modul, alur asesmen, kriteria penerimaan |
| `docs/02-arsitektur-dan-data.md` | Tumpukan teknologi, struktur folder, model data, desain anonimitas |
| `docs/03-aturan-penilaian.md` | Rumus penilaian, kalkulator sampel, statistik mutu data |
| `docs/04-privasi-keamanan.md` | Hak akses, pelindungan data pribadi, lokasi data, jejak audit, retensi |
| `docs/05-panduan-tampilan.md` | Tema Monokrom Perak dan Emas, huruf, pola komponen, aturan bahasa |
| `docs/08-penempatan.md` | Penempatan di DigitalOcean (Singapura) |
| `docs/09-uji-coba-codespaces.md` | Uji coba di GitHub Codespaces dengan data contoh saja |
| `docs/11-kebutuhan-aset-visual.md` | Logo, ikon, ilustrasi: nama, konsep, warna |
| `docs/12-kajian-metode.md` | Enam tahap penilaian dan dasar teorinya |
| `docs/13-verifikasi-scl-2.md` | Verifikasi metode terhadap SCL 2.0:2023 dan skema sertifikasinya, peta silang, usulan aturan penetapan tingkat, keputusan D1 sampai D6 |
| `seed/` | Data awal instrumen, parameter, dan fixture pengujian |
| `docs/arsip-v1/` | Dokumen implementasi versi 1; hanya rujukan sejarah |

## Tumpukan teknologi (jangan diganti tanpa persetujuan)

PHP 8.3, Laravel 13, Inertia 3 dengan React 19 dan TypeScript strict, Vite, Tailwind CSS 4 dan komponen shadcn/ui, PostgreSQL 16, Laravel Fortify (masuk, verifikasi dua langkah TOTP), antrean dan penjadwal Laravel dengan penggerak basis data, penyimpanan objek kompatibel S3 (DigitalOcean Spaces; MinIO saat pengembangan), PHPUnit, Pint, Docker.

Frontend React disajikan melalui Inertia, bukan sebagai aplikasi terpisah dengan API publik. Alasannya: hak akses diperiksa di server pada setiap halaman, tidak ada token yang disimpan di peramban, dan hanya satu unit yang dipasang.

## Perintah

```bash
docker compose up -d                 # postgres, minio, mailpit
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed           # skema dan organisasi operator (tanpa akun, tanpa data contoh)
php artisan nscas:create-admin EMAIL # pengelola sistem pertama; kata sandi acak tampil satu kali
php artisan nscas:demo               # data contoh, hanya di luar produksi
composer run dev                     # server, antrean, dan Vite
php artisan test                     # PHPUnit (basis data uji PostgreSQL nscas_laravel_test)
vendor/bin/pint                      # format PHP
npm run types:check && npm run check # TypeScript, lint, format
npm run build
```

## Aturan yang tidak boleh dilanggar

1. **Mesin penilaian adalah kode murni** di `app/Domain/Scoring/` tanpa Eloquent, `Illuminate\*`, fasad, atau I/O. Setiap perubahan wajib lolos semua fixture di `seed/fixtures/` dengan toleransi 1e-6. Jika hasil berbeda dari fixture, yang salah adalah kode, bukan fixture. Rujukan perhitungan ada di `seed/fixtures/referensi_skoring.py`, dan untuk aturan penetapan tangga per tema (D2) di `seed/fixtures/referensi_aturan_tema.py`. Seluruh `app/Domain/` murni dan dijaga tes `DomainPurityTest`.
2. **Anonimitas responden survei.** Tabel jawaban survei tidak boleh menyimpan, atau dapat dihubungkan ke, token akses, daftar responden, alamat IP, atau waktu kirim yang presisi. Lihat bagian Desain Anonimitas di `docs/02`. Penilaian mandiri manajemen tidak anonim dan diberi tahu demikian di layar.
3. **Sel laporan dengan kurang dari 5 responden disembunyikan** atau digabung, di dasbor, ekspor, dan laporan.
4. **Isolasi tenant.** Setiap kueri yang menyentuh data asesmen berangkat dari `App\Support\AssessmentAccess::visibleTo()` atau didahului `AssessmentAccess::require()`. Jangan mengandalkan pemeriksaan di sisi peramban. Pengguna tanpa peran pada sebuah asesmen menerima 404.
5. **Parameter terkunci.** Setelah asesmen berstatus `LOCKED`, bobot, ambang, versi instrumen, dan strata tidak dapat diubah. Nilainya dibaca dari `assessments.parameter_snapshot`, bukan dari berkas seed.
6. **Jejak audit.** Setiap perubahan data asesmen, skor, keputusan panel, dan unggahan bukti dicatat lewat `App\Support\Audit::record()`. Tabel `audit_logs` hanya boleh ditambah; pemicu basis data menolak UPDATE, DELETE, dan TRUNCATE.
7. **Lokasi data.** Produksi berada di DigitalOcean wilayah Singapura (`sgp1`) atas keputusan pemilik proyek. Syarat sebelum ada data responden nyata: persetujuan tertulis klien atas lokasi ini, dan teks persetujuan responden menyebut Singapura (docs/04). Jangan menambahkan layanan pihak ketiga lain yang menerima data responden (analitik, pelacak galat, huruf atau skrip dari CDN, API AI) tanpa persetujuan tertulis.
8. **Hak cipta NEN.** Jangan menyalin kriteria skema sertifikasi Safety Culture Ladder ke dalam kode, seed, atau antarmuka. Gunakan hanya struktur yang ada di `seed/aspek-dan-parameter.json` dan pernyataan karya Nusa Safety di `seed/instrumen-karakteristik-v1.json`.
9. **Rahasia** tidak pernah ditulis ke kode atau dikomit. Gunakan `.env` (sudah di `.gitignore`) dan `.env.example` tanpa nilai asli.

## Konvensi kode

- Identifier, nama berkas, dan pesan komit dalam bahasa Inggris. Komentar boleh bahasa Indonesia.
- Seluruh teks antarmuka melalui berkas bahasa: `resources/js/i18n/id` (sumber) dan `resources/js/i18n/en` untuk halaman React, `lang/id` dan `lang/en` untuk pesan server. Kunci kedua bahasa harus sama. Pengendali mengirim kunci dan angka, bukan kalimat.
- Validasi masukan dengan Form Request atau `$request->validate()` di setiap pengendali yang menerima data.
- Angka di antarmuka memakai format Indonesia: koma desimal, titik ribuan (`Intl.NumberFormat('id-ID')`). Perhitungan tetap memakai presisi penuh; pembulatan hanya saat ditampilkan.
- Aturan bisnis ditulis di `app/Domain/` (murni) dan dipanggil dari layanan atau pengendali. Pengendali tetap tipis.
- Halaman survei responden harus ringan: tidak memuat kode konsol, dan muatannya diuji terhadap batas 350 KB.
- Satu fitur selesai bila: tes unit dan tes fitur terkait lulus, Pint dan pemeriksaan TypeScript bersih, teks antarmuka lengkap dalam kedua bahasa, dan aksi penting tercatat di jejak audit.

## Aturan bahasa antarmuka (bahasa Indonesia)

Baku dan formal. Tidak memakai singkatan kecuali K3 (dijelaskan saat pertama muncul) dan nama produk. Tulis "alat pelindung diri", bukan "APD"; "diskusi kelompok terarah", bukan "FGD"; "verifikasi dua langkah", bukan "2FA"; "surel", bukan "email". Jangan memakai tanda pisah panjang. Gunakan istilah yang dipahami pekerja lapangan. Rincian ada di `docs/05`.

## Cara bekerja dengan pemilik proyek

Pemilik proyek: M. Reza Huzain (Nusa Safety). Kerjakan satu fase dari `PROMPTS.md` per sesi. Mulai setiap fase dengan rencana singkat, kerjakan, jalankan tes, lalu laporkan apa yang selesai, apa yang belum, dan keputusan yang perlu dikonfirmasi. Jangan melompat ke fase berikutnya tanpa diminta.
