# 15. Hasil Uji Menyeluruh dan Kesiapan Penempatan (Fase R12)

Dokumen ini mencatat hasil uji fase R12 pada 19 November 2026: uji ujung ke ujung satu siklus penuh, uji beban survei, aplikasi kamera observasi yang dapat dipasang, dan kesiapan penempatan. Semua uji dijalankan di lingkungan penyusunan dengan data buatan. Tidak ada perintah yang dijalankan di server produksi.

## 1. Ringkasan

| Uji | Hasil | Catatan |
|---|---|---|
| Tes PHPUnit (unit dan fitur) | Lulus, 397 tes | Termasuk fixture mesin penilaian pada toleransi 1e-6 |
| Uji ujung ke ujung satu siklus penuh | Lulus, 4 langkah, 26 detik | Draf sampai Pemantauan, sembilan transisi sungguhan |
| Uji beban, pola realistis, 300 responden | Lulus, 0 kegagalan | Kirim p95 70 ms; garis dasar 59 ms |
| Uji beban, serentak, 300 responden | Lulus, 0 kegagalan | Kirim p95 3,6 detik; antre di 8 utas pada 4 vCPU |
| Aplikasi kamera observasi (PWA) | Lulus di peramban telepon tiruan | Uji di telepon sungguhan pada domain produksi masih tertunda |
| Tampilan 360, 768, 1024, 1440 piksel | Lulus untuk halaman fase R11 dan R12 | Tanpa luapan dan tanpa galat JavaScript |
| Audit kerentanan pustaka | Tidak ada temuan | `composer audit`, `npm audit` |
| Analisis statis Larastan tingkat 5 | 130 temuan tipe, 4 sudah diperbaiki; belum memblokir | Lihat bagian 5 |

## 2. Uji ujung ke ujung

Berkas: `tests/e2e/full-cycle.spec.ts`, `playwright.config.ts`, `tests/e2e/serve.sh`, dan perintah pembantu `nscas:e2e-cycle`. Server uji memakai basis data tersendiri `nscas_laravel_e2e` yang dikosongkan setiap kali dan aset hasil `npm run build`. Perintah pembantu menolak berjalan pada basis data yang namanya tidak berakhiran `_e2e`.

Pembagian kerja dalam uji:

| Dijalankan lewat peramban | Dijalankan lewat layanan yang sama dengan pengendali |
|---|---|
| Masuk tiga akun; membuat asesmen; sembilan transisi status dari pusat asesmen oleh asesor utama | Unit, populasi strata, tim, parameter, rencana sampel, komunikasi awal, kalibrasi |
| Seorang pekerja mengisi survei dari telepon (Pixel 7) sampai terkirim | Daftar responden 60 orang, tautan, masa survei; 40 jawaban survei lain dan satu penilaian mandiri |
| Menutup survei, tinjauan mutu data, membuat sesi dari usulan | Alasan partisipasi rendah dan tinjauan partisipasi |
| Menjalankan perhitungan dan menetapkan hasil rapat panel | Nilai sesi validasi, tinjauan bukti 18 karakteristik, nilai bukti dua asesor, keputusan panel yang diperlukan |
| Menerbitkan rencana aksi, menyimpan dan menandatangani laporan lengkap dan ringkasan pekerja, mencatat komunikasi hasil | Analisis penyebab dan satu tindakan untuk setiap kesenjangan |
| Membuka dasbor hasil dan jejak audit | |

Pembagian ini disengaja: langkah berulang tidak menambah keyakinan bila diulang lewat peramban, sedangkan setiap transisi tetap diperiksa oleh pemeriksa syarat yang sama dengan produksi, sehingga syarat yang tidak terpenuhi akan menggagalkan uji. Uji juga gagal bila ada galat JavaScript atau respons 5xx di halaman mana pun yang dibuka.

Keadaan akhir basis data uji setelah lulus: status MONITORING; jejak audit memuat sembilan perubahan status berurutan (CONFIGURED, LOCKED, DATA_COLLECTION, VALIDATION, SCORING, PANEL_REVIEW, ACTION_PLANNING, REPORTED, MONITORING); 41 jawaban survei; satu penilaian mandiri terkirim; sembilan sesi validasi; satu eksekusi final; laporan lengkap dan ringkasan pekerja bertanda tangan; rencana aksi terbit.

Menjalankan ulang:

```bash
npm run build
npm run e2e            # memerlukan PostgreSQL lokal dan Chromium Playwright 1.63
```

## 3. Uji beban survei

Berkas: `tests/load/survey-load.mjs` (Node 22 tanpa dependensi) dan langkah `nscas:e2e-cycle load` yang menyiapkan satu asesmen berstatus pengumpulan data dengan 330 tautan lewat transisi sungguhan.

Lingkungan: image produksi NSCAS (FrankenPHP mode klasik, `APP_ENV=production`, OPcache aktif, 8 utas PHP) di mesin 4 vCPU dan 15 GB memori, PostgreSQL 16 di mesin yang sama, cache dan sesi di basis data seperti `.env.production.example`. Setiap responden memakai token berbeda dan menjalankan tiga permintaan: membuka halaman, menandai tautan dibuka, dan mengirim jawaban lengkap 18 karakteristik dan butir iklim. Responden dibagi ke sepuluh alamat IP untuk meniru beberapa lokasi proyek; pembatas laju server tidak diubah.

Waktu tanggap dalam milidetik:

| Profil | Langkah | Rata-rata | p50 | p95 | p99 | Maks | Gagal |
|---|---|---|---|---|---|---|---|
| Garis dasar, 5 berurutan sebelum pola realistis | kirim | 53 | 51 | 59 | 59 | 59 | 0 |
| Realistis, 300 responden mulai dalam 60 detik, mengisi 20 sampai 40 detik | halaman | 40 | 39 | 52 | 58 | 89 | 0 |
| | tanda dibuka | 28 | 27 | 36 | 41 | 46 | 0 |
| | kirim | 54 | 52 | 70 | 79 | 90 | 0 |
| Serentak, 300 responden pada detik yang sama | halaman | 1.573 | 1.594 | 2.850 | 2.957 | 2.989 | 0 |
| | tanda dibuka | 2.612 | 2.593 | 2.798 | 2.841 | 2.870 | 0 |
| | kirim | 3.082 | 3.132 | 3.564 | 3.604 | 3.633 | 0 |

Penafsiran:

1. Pola realistis adalah yang dimaksud `docs/01` bagian 5. Pada pola ini waktu kirim p95 70 ms, hampir sama dengan garis dasar 59 ms, sehingga tidak ada penurunan berarti. Waktu isi dipersingkat dari 2 sampai 4 menit menjadi 20 sampai 40 detik agar uji selesai cepat; artinya beban per detik dalam uji justru lebih tinggi daripada pola nyata.
2. Pola serentak jauh lebih berat daripada kenyataan (300 orang menekan tombol pada detik yang sama). Semua 900 permintaan tetap berhasil dalam 9 detik; waktu tanggap naik karena permintaan mengantre di 8 utas PHP. Bila pola seperti ini diperkirakan, misalnya pengisian bersama setelah safety talk di satu lokasi, gunakan ukuran server 4 vCPU atau lebih sesuai `docs/08` bagian 3.
3. Jumlah jawaban tersimpan sama dengan jumlah token selesai (915 pada akhir uji), dan tabel jawaban tetap tanpa rujukan ke token (aturan anonimitas).
4. Keterbatasan: server dan basis data berada di mesin yang sama dengan pembangkit beban, dan jaringan telepon tidak ditiru. Ulangi uji pada Droplet sungguhan sebelum dipakai klien (`docs/08` bagian 12 butir 11).

## 4. Aplikasi kamera observasi yang dapat dipasang

Keputusan R5 diterapkan sebagai berikut:

- `public/manifest.webmanifest`: nama "NSCAS Observasi Lapangan", tampilan mandiri, warna tema marun, ikon 192 dan 512 piksel, alamat awal `/observe`.
- `/observe`: pintu masuk yang menampilkan masa observasi yang sedang terbuka dan boleh direkam pengguna, lintas asesmen. Bila hanya ada satu, kamera langsung dibuka.
- `public/sw.js`: service worker minimal yang hanya menampilkan `public/offline.html` bila navigasi gagal karena tidak ada sambungan. Tidak ada halaman, data, maupun rekaman yang disimpan di perangkat, sehingga tidak menambah risiko data pribadi.
- Manifes dan service worker hanya dipasang di halaman kamera dan pintu masuknya, tidak di halaman survei responden. Caddyfile di `Dockerfile` menyajikan ketiga berkas dengan `Cache-Control: no-cache` (berlaku setelah image dibangun ulang).

Hasil di peramban telepon tiruan (Chromium, profil Pixel 7): manifes terbaca, service worker terdaftar dengan cakupan `/`, `/observe` membuka kamera masa observasi yang terbuka, dan halaman luring tampil saat sambungan diputus. Tidak ada galat JavaScript.

Uji yang masih tertunda karena memerlukan domain HTTPS produksi dan telepon sungguhan:

1. Android (Chrome): buka alamat NSCAS, masuk, buka Kamera observasi, lalu pilih Instal aplikasi atau Tambahkan ke layar utama. Buka dari ikon; pastikan tampil tanpa bilah alamat dan kamera serta lokasi dapat diizinkan.
2. iPhone (Safari): Bagikan, lalu Tambahkan ke Layar Utama. Pastikan kamera dan lokasi dapat diizinkan dari aplikasi yang dipasang.
3. Matikan data seluler, buka aplikasi dari ikon, dan pastikan halaman "Tidak ada sambungan internet" tampil.

## 5. Analisis statis Larastan

Larastan 3.15 (PHPStan 2.3) tingkat 5 berjalan di CI untuk pertama kali pada komit fase R11 dan menghasilkan 130 temuan. Pengelompokannya:

| Jumlah | Kelompok | Sebab utama |
|---|---|---|
| sekitar 70 | Kolom JSON dan waktu dibaca sebagai teks (indeks pada teks, metode tanggal pada teks, fungsi yang meminta larik menerima teks, fungsi panggil balik `map` yang tipenya tidak dapat ditentukan) | 22 model belum diberi anotasi `@property`, sehingga Larastan membaca tipe dari migrasi, bukan dari `casts()` |
| 8 | Atribut hasil `withCount` dan `withSum` tidak dideklarasikan | Anotasi model belum memuat atribut tambahan itu |
| sekitar 30 | Kode berlebih: `array_values` pada daftar, pemeriksaan `is_array` yang selalu benar, operator `?->` yang tidak perlu, blok `catch` yang tidak pernah terjadi | Gaya penulisan; tidak mengubah perilaku |
| sekitar 12 | Bentuk larik dan tipe kembalian pada docblock tidak cocok dengan isi sebenarnya | Docblock kurang lengkap |
| 4 | Atribut `Illuminate\Console\Attributes\AsCommand` tidak ada | Sudah diperbaiki pada fase ini: deskripsi empat perintah terjadwal sebelumnya kosong di `php artisan list`; nama perintah dan jadwalnya tidak terdampak |

Tidak ada temuan yang menunjukkan galat saat aplikasi berjalan pada jalur yang diuji; seluruh tes fitur lulus pada kode yang sama. Langkah CI dibiarkan tidak memblokir sampai sisa temuan diperbaiki, dicatat sebagai tugas di luar fase di `PROMPTS.md`. Paket Larastan tidak dapat diunduh di lingkungan penyusunan karena pembatasan jaringan ke github.com, sehingga perbaikan sebaiknya dikerjakan di lingkungan yang dapat menjalankan `composer analyse`.

## 6. Kesiapan penempatan

Berkas penempatan dari fase R0.7 tetap berlaku (`docs/08`). Perubahan fase R11 dan R12 yang perlu diperhatikan saat penempatan:

| Butir | Nilai produksi | Sumber |
|---|---|---|
| Hash kata sandi | `HASH_DRIVER=argon2id` | `.env.production.example` |
| Batas sesi | `SESSION_LIFETIME=480`; batas 30 menit tanpa aktivitas untuk pengguna Nusa Safety ditegakkan aplikasi | `docs/04` bagian 3 |
| Penanda masa simpan | Berjalan otomatis setiap Senin 07.10 WIB lewat kontainer `scheduler` | `routes/console.php` |
| Kamera observasi | Memerlukan HTTPS; berkas PWA disajikan tanpa cache | `Dockerfile` (Caddyfile) |
| PDF laporan dan berita acara | Chromium sudah ada di image | `docs/08` bagian 9b |

Butir yang masih harus dipenuhi sebelum data responden nyata, berdasarkan `docs/08` bagian 12 dan `docs/14`:

1. Persetujuan tertulis PT Adhi Karya atas lokasi data di Singapura (`docs/04` bagian 1.1).
2. Penempatan pertama ke Droplet dengan domain dan sertifikat TLS, lalu daftar periksa `docs/08` bagian 12.
3. Uji beban ulang pada Droplet sungguhan dan uji kamera di telepon sungguhan (bagian 3 dan 4).
4. Uji penetrasi oleh pihak ketiga (`docs/14` butir K28).
5. Perbaikan temuan Larastan, lalu langkah CI dijadikan memblokir (`docs/14` butir K15).
