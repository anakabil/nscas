# 14. Daftar Periksa Keamanan dan Privasi

Dokumen ini adalah daftar periksa keamanan NSCAS versi 2, disusun pada fase R11 (19 November 2026) sebagai pengganti daftar periksa versi 1 (`docs/arsip-v1/06`). Setiap butir menyebut kendali yang diharapkan, cara penerapannya di kode, bukti yang dapat diperiksa ulang, dan statusnya. Butir berstatus Sebagian atau Belum memuat tindak lanjut beserta pemiliknya.

## 1. Dasar

Rujukan utama adalah regulasi nasional tentang pelindungan data pribadi dan penyelenggaraan sistem elektronik. Karena regulasi tersebut tidak merinci kendali teknis aplikasi web, rincian kendali diambil dari standar verifikasi keamanan aplikasi OWASP.

1. Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, khususnya kewajiban pengendali data untuk menjaga keamanan pemrosesan, mencegah akses yang tidak sah, mencatat kegiatan pemrosesan, serta menghapus atau memusnahkan data pribadi setelah masa retensi berakhir.
2. Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik, khususnya kewajiban penyelenggara sistem elektronik menyediakan sistem yang andal, aman, dan dapat ditelusuri.
3. OWASP Application Security Verification Standard 4.0.3, tingkat 2, sebagai acuan butir kendali.
4. OWASP Top 10 tahun 2021 sebagai acuan kelas risiko.

Hasil NSCAS adalah pengukuran internal, bukan sertifikat. Daftar ini tidak menggantikan uji penetrasi oleh pihak ketiga.

## 2. Status ringkas

| Kelompok | Terpenuhi | Sebagian | Belum |
|---|---|---|---|
| Autentikasi dan sesi (K1 sampai K6) | 6 | 0 | 0 |
| Hak akses dan isolasi tenant (K7 sampai K9) | 3 | 0 | 0 |
| Masukan, keluaran, dan berkas (K10 sampai K13) | 4 | 0 | 0 |
| Pustaka dan analisis kode (K14 sampai K15) | 1 | 1 | 0 |
| Data pribadi dan anonimitas (K16 sampai K21) | 5 | 0 | 1 |
| Jejak audit dan pemantauan (K22 sampai K24) | 3 | 0 | 0 |
| Infrastruktur (K25 sampai K28) | 2 | 1 | 1 |

## 3. Butir pemeriksaan

### 3.1 Autentikasi dan sesi

| No | Kendali | Penerapan | Bukti | Status |
|---|---|---|---|---|
| K1 | Kata sandi di-hash dengan algoritme yang lambat dan bergaram | argon2id, memori 64 MiB, 3 putaran (`config/hashing.php`, `HASH_DRIVER=argon2id`), di atas batas minimum OWASP. Hash lama di-hash ulang saat masuk | `tests/Feature/Security/SessionSecurityTest.php` memeriksa algoritme | Terpenuhi |
| K2 | Kata sandi kuat | Di produksi minimal 12 karakter dengan huruf besar dan kecil, angka, dan simbol (`Password::defaults` di `AppServiceProvider`). Pemeriksaan basis data kebocoran tidak dipakai karena memanggil layanan luar negeri (aturan 7) | `tests/Feature/Settings/SecurityTest.php` | Terpenuhi |
| K3 | Verifikasi dua langkah untuk peran berisiko | TOTP wajib untuk pengelola sistem, asesor utama, asesor, dan administrator klien bila `NSCAS_ENFORCE_TWO_FACTOR=true` (bawaan produksi); kode pemulihan sekali pakai | `EnsureAccountIsUsable`, `tests/Feature/Auth/TwoFactorChallengeTest.php` | Terpenuhi |
| K4 | Penguncian setelah percobaan gagal | 5 kali gagal dalam 15 menit per pasangan surel dan alamat IP; hanya kegagalan yang dihitung; pesan galat menyebut lama penguncian (`App\Auth\LoginLockout`) | `SessionSecurityTest` | Terpenuhi |
| K5 | Batas sesi | 8 jam sejak masuk untuk semua pengguna; 30 menit tanpa aktivitas untuk pengguna Nusa Safety; masuk lewat kuki "ingat saya" ditolak dan pilihannya dihapus dari halaman masuk (`EnforceSessionLimits`, `SessionPolicy`) | `SessionSecurityTest` | Terpenuhi |
| K6 | Kuki sesi aman | Sesi di basis data dan terenkripsi, `Secure`, `HttpOnly`, `SameSite=Lax`; token dibuat ulang saat masuk dan keluar | `.env.production.example` | Terpenuhi |

### 3.2 Hak akses dan isolasi tenant

| No | Kendali | Penerapan | Bukti | Status |
|---|---|---|---|---|
| K7 | Hak akses diperiksa di server pada setiap halaman | Matriks `docs/04` bagian 2 di `App\Domain\Access\Permissions`; Inertia tanpa API publik | `AssessmentAccessTest` | Terpenuhi |
| K8 | Isolasi tenant | Setiap kueri data asesmen melalui `AssessmentAccess::visibleTo()` atau `require()`; pengguna tanpa peran menerima 404 | `AssessmentAccessTest`, tes fitur per modul | Terpenuhi |
| K9 | Halaman pengelola tidak terungkap | Halaman Retensi data dan berita acaranya mengembalikan 404 bagi selain pengelola sistem | `AuditRetentionTest` | Terpenuhi |

### 3.3 Masukan, keluaran, dan berkas

| No | Kendali | Penerapan | Bukti | Status |
|---|---|---|---|---|
| K10 | Validasi masukan di server | Form Request atau `$request->validate()` di setiap pengendali yang menerima data | Tinjauan kode, tes validasi per modul | Terpenuhi |
| K11 | Kebijakan keamanan konten dan header | CSP dengan nonce tanpa skrip pihak ketiga, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `nosniff`, HSTS, `Permissions-Policy` (`SecurityHeaders`); berita acara dan laporan HTML disajikan dengan CSP tanpa skrip | `SecurityHeadersTest` | Terpenuhi |
| K12 | Injeksi rumus pada ekspor | Sel CSV jejak audit yang diawali `=`, `+`, `-`, `@`, tab, atau carriage return diberi awalan kutip tunggal (`App\Domain\Audit\AuditCsv`) | `AuditCsvTest`, `AuditRetentionTest` | Terpenuhi |
| K13 | Unggahan berkas | Jenis diperiksa dari isi, batas 25 MB, SHA-256 dihitung server, URL unggah dan unduh bertanda tangan berumur pendek, bucket privat | Tes bukti dan observasi | Terpenuhi |

### 3.4 Pustaka dan analisis kode

| No | Kendali | Penerapan | Bukti | Status |
|---|---|---|---|---|
| K14 | Pustaka tanpa kerentanan yang diketahui | `composer audit --locked` dan `npm audit --omit=dev --audit-level=high` dijalankan di CI dan memblokir. Hasil 19 November 2026: tidak ada temuan | `.github/workflows/tests.yml` | Terpenuhi |
| K15 | Analisis statis PHP | Larastan tingkat 5 untuk `app/` (`phpstan.neon`, `composer analyse`). Paket tidak dapat diunduh di lingkungan pengembangan karena pembatasan jaringan, sehingga dijalankan di CI tanpa memblokir sampai temuan pertama ditinjau | CI langkah Static analysis | Sebagian. Tindak lanjut: tinjau temuan CI, perbaiki, lalu jadikan memblokir (pengembang) |

### 3.5 Data pribadi dan anonimitas

| No | Kendali | Penerapan | Bukti | Status |
|---|---|---|---|---|
| K16 | Anonimitas jawaban survei | Tabel jawaban tanpa token, daftar responden, alamat IP, atau waktu kirim presisi; baris diacak setiap malam | `tests/Feature/Survey` | Terpenuhi |
| K17 | Sel kecil disembunyikan | Kelompok dengan kurang dari 5 responden disembunyikan di dasbor, ekspor, dan laporan | Tes hasil dan laporan | Terpenuhi |
| K18 | Enkripsi kolom data pribadi | Surel dan nomor telepon responden, surel penilai mandiri, dan surel penanggung jawab aksi memakai enkripsi Laravel (AES-256-CBC dengan HMAC-SHA256, kunci `APP_KEY`); rahasia TOTP dan kode pemulihan dienkripsi Fortify | Model `RosterEntry`, `SelfAssessment`, `ActionItem` | Terpenuhi |
| K19 | Masa simpan dan pemusnahan | Masa simpan bawaan 36 bulan sejak laporan lengkap final ditandatangani (atau sejak hasil ditetapkan). Tugas mingguan menandai dan memberi tahu pengelola sistem; pemusnahan setelah konfirmasi tertulis klien, dengan berita acara PDF yang tidak dapat diubah | `AuditRetentionTest`, `RetentionRulesTest` | Terpenuhi |
| K20 | Minimisasi data pada laporan dan jejak | Laporan tanpa nama narasumber; surel yang dicoba saat gagal masuk tetapi tidak terdaftar hanya disimpan sebagai HMAC; administrator klien melihat jejak audit tanpa isi perubahan | `ReportTest`, `SessionSecurityTest`, `AuditRetentionTest` | Terpenuhi |
| K21 | Persetujuan klien atas lokasi data di Singapura dan teks persetujuan responden | Templat persetujuan menyebut lokasi; persetujuan tertulis klien belum diterima | `docs/04` bagian 1.1 | Belum. Tindak lanjut: persetujuan tertulis PT Adhi Karya sebelum data responden nyata (pemilik proyek) |

Catatan K19: jejak audit tetap disimpan setelah pemusnahan karena menjadi bukti penelusuran. Beberapa catatan audit memuat nama, misalnya nama narasumber yang ditambahkan dan nama penilai mandiri. Hal ini sesuai keputusan v1 bahwa jejak audit disimpan, tetapi perlu ditegaskan dalam perjanjian pemrosesan data dengan klien.

### 3.6 Jejak audit dan pemantauan

| No | Kendali | Penerapan | Bukti | Status |
|---|---|---|---|---|
| K22 | Jejak audit tidak dapat diubah | Tabel `audit_logs` hanya-tambah; pemicu menolak UPDATE, DELETE, dan TRUNCATE. Berita acara pemusnahan dilindungi pemicu `destruction_record_guard` | Tes pemicu | Terpenuhi |
| K23 | Peristiwa akses dicatat | Masuk, gagal masuk, penguncian, keluar, sesi berakhir, ganti dan atur ulang kata sandi, serta aktivasi, penonaktifan, dan kegagalan verifikasi dua langkah (`RecordAccessEvents`). Dua puluh peristiwa terakhir tampil di halaman Status sistem | `SessionSecurityTest` | Terpenuhi |
| K24 | Penelusuran per asesmen | Halaman Jejak audit dengan penyaring kategori dan tanggal; ekspor CSV oleh asesor utama, dan ekspornya sendiri tercatat | `AuditRetentionTest` | Terpenuhi |

### 3.7 Infrastruktur

| No | Kendali | Penerapan | Bukti | Status |
|---|---|---|---|---|
| K25 | Rahasia tidak masuk repositori | `.env` diabaikan Git; contoh tanpa nilai asli | `git ls-files` | Terpenuhi |
| K26 | TLS dan cadangan terenkripsi | Caddy dengan TLS otomatis; `backup.sh` mengenkripsi cadangan harian dengan age dan memeriksa kepala berkasnya (`docs/08`) | `deploy/digitalocean/backup.sh` | Terpenuhi |
| K27 | Pembatasan laju lintas akun | Penguncian per akun (K4) dan pembatas laju rute survei. Belum ada pembatas per alamat IP untuk percobaan masuk ke banyak akun sekaligus | `AppServiceProvider` | Sebagian. Tindak lanjut: aktifkan pembatas di Caddy atau firewall DigitalOcean saat penempatan (fase R12) |
| K28 | Uji penetrasi | Belum dilakukan | Tidak ada | Belum. Tindak lanjut: uji penetrasi pihak ketiga sebelum data responden nyata (pemilik proyek) |

## 4. Cara memeriksa ulang

```bash
php artisan test --filter='Security|AssessmentAccess|Anonymity'
composer audit --locked
npm audit --omit=dev --audit-level=high
composer analyse        # setelah paket Larastan terpasang
```

Daftar ini ditinjau ulang setiap ada modul baru, perubahan tumpukan teknologi, atau sebelum penempatan produksi.

## 5. Referensi

OWASP Foundation. (2021). *OWASP Application Security Verification Standard 4.0.3*. https://owasp.org/www-project-application-security-verification-standard/

OWASP Foundation. (2021). *OWASP Top 10:2021*. https://owasp.org/Top10/

OWASP Foundation. (t.t.). *Password storage cheat sheet*. OWASP Cheat Sheet Series. Diakses 19 November 2026, dari https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

Peraturan Pemerintah Republik Indonesia Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik. (2019). Lembaran Negara Republik Indonesia Tahun 2019 Nomor 185.

Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. (2022). Lembaran Negara Republik Indonesia Tahun 2022 Nomor 196.
