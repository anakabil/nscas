# 09. Uji Coba di GitHub Codespaces

Dokumen ini menjelaskan cara menjalankan NSCAS versi 2 di GitHub Codespaces. Lingkungan ini dipakai selama server DigitalOcean belum dipasang (docs/08). Tujuannya agar pemilik proyek dan tim Nusa Safety dapat mencoba aplikasi dari peramban, termasuk dari telepon, tanpa memasang apa pun dan tanpa membeli server.

Codespaces adalah layanan GitHub yang menyalakan mesin sementara berisi kode repositori. Satu codespace menjalankan aplikasi, basis data PostgreSQL, dan kotak surat uji. Alamatnya dapat dibagikan kepada tim. Lingkungan ini bukan produksi, dan isinya hanya data contoh.

Panduan versi 1 (Next.js) tersimpan di riwayat Git pada komit `8ad6b3d`. Codespace yang dibuat untuk versi 1 masih menjalankan aplikasi lama dan tidak dapat dipakai untuk versi 2. Hapus codespace lama itu, lalu buat yang baru sesuai bagian 2.

## 1. Batasan yang wajib dipatuhi

1. Tanpa data pekerja sungguhan. Codespaces berjalan di pusat data GitHub di luar Indonesia. Lokasi ini berbeda dari lokasi produksi yang disepakati di docs/04 dan docs/08 (DigitalOcean, Singapura), dan tidak tercakup persetujuan klien. Nama, surel, nomor telepon, dan jawaban pekerja sungguhan tidak boleh dimasukkan (CLAUDE.md aturan 7). Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 56, juga mensyaratkan pelindungan yang setara bila data pribadi dikirim ke luar wilayah hukum Indonesia. Untuk latihan, gunakan nama dan surel rekaan.
2. Bukan untuk survei lapangan. Codespace mati sendiri saat tidak dipakai (butir 4). Selama codespace mati, alamat aplikasi tidak dapat dibuka.
3. Hasil latihan, bukan hasil resmi. Hasil di lingkungan ini bukan hasil pengukuran resmi dan bukan sertifikat Safety Culture Ladder.
4. Mati otomatis. Codespace berhenti setelah 30 menit tidak dipakai. Batas ini dapat diubah sampai 240 menit di github.com, Settings, Codespaces, Default idle timeout. Data tetap tersimpan sampai codespace dihapus. Codespace yang lama berhenti dihapus otomatis oleh GitHub sesuai pengaturan Default retention period.
5. Kuota gratis. Akun GitHub pribadi tanpa langganan mendapat 120 jam inti dan 15 GB-bulan penyimpanan Codespaces per bulan (GitHub, 2026). Mesin 2 inti memakai 2 jam inti per jam menyala, sehingga kuota cukup untuk sekitar 60 jam pemakaian per bulan. Sisa kuota dapat dilihat di github.com, Settings, Billing and plans. Setelah kuota habis, Codespaces berhenti dapat dipakai sampai bulan berikutnya, kecuali batas belanja dan cara bayar sudah diatur.
6. Surel tidak keluar. Surel dari aplikasi, misalnya pengaturan ulang kata sandi, ditampung di kotak surat uji (Mailpit) dan tidak terkirim ke alamat mana pun.
7. Alamat dapat dibuka siapa saja yang memegang tautannya. Port aplikasi dibuka untuk umum agar tim dapat mencoba tanpa akun GitHub. Akun contoh dilindungi kata sandi acak yang dibuat khusus untuk codespace ini. Bagikan alamat dan kata sandi hanya kepada tim.
8. Alamat berubah bila codespace baru dibuat. Bentuknya `https://<nama-codespace>-8000.app.github.dev`.

## 2. Membuat codespace (sekali)

1. Buka `https://github.com/anakabil/nscas` dan masuk dengan akun GitHub pemilik repositori.
2. Bila masih ada codespace versi 1, buka `https://github.com/codespaces`, klik tanda tiga titik pada codespace itu, lalu Delete.
3. Kembali ke halaman repositori. Klik tombol hijau Code, pilih tab Codespaces, klik tanda tiga titik, lalu New with options.
4. Pilih cabang `claude/great-pasteur-31n82q`, Region Southeast Asia, dan Machine type 2-core. Klik Create codespace.
5. Editor VS Code terbuka di peramban. Penyiapan berjalan otomatis: memasang dependensi, membuat kunci acak, menyiapkan basis data dan data contoh, lalu membangun dan menyalakan aplikasi. Kemajuannya dapat dilihat di berkas `.codespace/logs/setup.log`.
6. Penyiapan selesai bila log menampilkan "Penyiapan selesai". Perkiraan waktunya 10 sampai 15 menit pada pembuatan pertama.

## 3. Membuka aplikasi

1. Buka berkas `.codespace/akun-uji-coba.txt` dari panel Explorer di kiri. Berkas ini berisi alamat aplikasi, daftar akun contoh, dan satu kata sandi untuk semua akun contoh. Berkas ini tidak pernah dikomit ke repositori.
2. Buka tab Ports di bagian bawah editor. Port 8000 (NSCAS) harus berstatus Public. Bila masih Private, klik kanan port tersebut, pilih Port Visibility, lalu Public.
3. Buka alamat aplikasi dan masuk dengan salah satu akun berikut.

| Surel | Jenis akun |
|---|---|
| `pengelola@contoh.test` | Pengelola sistem |
| `asesor.utama@contoh.test` | Asesor utama, Nusa Safety |
| `asesor@contoh.test` | Asesor, Nusa Safety |
| `admin.klien@contoh.test` | Administrator klien, PT Konstruksi Contoh |
| `koordinator@contoh.test` | Koordinator unit, PT Konstruksi Contoh |
| `eksekutif@contoh.test` | Peninjau eksekutif, PT Konstruksi Contoh |

4. Kotak surat uji dibuka dari tab Ports, baris "Kotak surat uji (Mailpit)", port 8025. Port ini tetap Private, hanya untuk pemilik codespace.

## 4. Yang dapat dicoba pada versi ini

Versi 2 saat ini berada di akhir fase R11 (privasi, retensi, jejak audit, dan keamanan). Yang sudah dapat dicoba:

1. Halaman masuk, pilihan bahasa Indonesia dan Inggris (tersimpan di akun), dan pengaturan ulang kata sandi melalui kotak surat uji.
2. Dasbor progres pengukuran di beranda, untuk akun pengelola sistem, asesor utama, asesor, dan administrator klien. Dasbor diperbarui otomatis setiap 60 detik.
3. Organisasi dan pengguna: menambah organisasi klien, membuat akun dengan kata sandi sementara, mengubah peran, dan menonaktifkan akun. Coba dengan akun pengelola sistem atau administrator klien.
4. Asesmen baru dengan akun asesor utama, lalu tujuh halaman tahap Perencanaan: rincian, unit, strata, parameter, kalkulator sampel, tim asesor, serta komunikasi awal dan kalibrasi.
5. Mengubah status asesmen dari Draf ke Pengaturan lengkap, lalu ke Parameter terkunci, di pusat asesmen. Setelah terkunci, parameter tidak dapat diubah lagi.
6. Tahap 2 pada asesmen contoh "Kantor Pusat 2026" (sekitar 2.400 responden fiktif dengan partisipasi yang sudah berjalan):
   - Responden dan undangan, dengan akun administrator klien: unduh templat Excel, isi beberapa baris, periksa lalu simpan; terbitkan tautan dan unduh CSV-nya; kirim undangan, lalu lihat surelnya di kotak surat uji (Mailpit); cabut dan terbitkan ulang token seorang responden; ubah masa survei.
   - Kode QR, dengan akun administrator klien: buat kode untuk satu unit, cetak lembar A4, lalu pindai kode dari telepon untuk melihat halaman responden.
   - Partisipasi, dengan akun mana pun yang berhak: tabel per strata dan unit, angka di bawah 5 yang disembunyikan, dan perkembangan harian.
   - Akun koordinator unit hanya melihat Divisi Gedung beserta proyek di bawahnya.
7. Survei responden di telepon: dengan akun administrator klien, terbitkan ulang tautan seorang responden di halaman Responden (tombol putar ulang), lalu buka tautannya di peramban telepon; atau pindai kode QR yang baru dibuat. Isi survei sampai selesai. Buka Daftar pertanyaan untuk berpindah ke pertanyaan mana pun yang sudah dijawab, dan pakai tombol Ubah di halaman Periksa jawaban sebelum mengirim. Coba juga mematikan sambungan data sebelum menekan Kirim: jawaban terkirim otomatis begitu sambungan kembali, dan angka di halaman Partisipasi bertambah. Tautan yang sama tidak dapat dipakai dua kali.
8. Penilaian mandiri manajemen: dengan akun administrator klien, buka tab Penilaian mandiri, terbitkan tautan untuk seorang manajer, lalu buka tautannya. Pilih pernyataan, tulis alasan paling sedikit 50 karakter, dan centang bukti pendukung untuk setiap karakteristik; Daftar karakteristik menunjukkan mana yang belum lengkap. Kirim, lalu dengan akun asesor utama buka Lihat jawaban untuk membaca alasan dan judul bukti yang ditautkan.
9. Bukti dokumen, dengan akun administrator klien: buka tab Bukti dokumen, lihat daftar periksa per karakteristik, unggah PDF atau gambar dan petakan ke karakteristik serta butir daftar periksanya, ubah pemetaan, unggah versi baru, unduh, lalu hapus. Akun koordinator unit hanya dapat mengunggah untuk unitnya; akun asesor hanya membaca. Di Codespaces berkas disimpan di disk codespace, bukan di penyimpanan objek.
10. Observasi lapangan: dengan akun asesor utama, buka tab Observasi lapangan dan buka masa observasi untuk proyek; dengan akun administrator klien di telepon, tekan Buka kamera, izinkan kamera dan lokasi, ambil foto, lalu kirim. Asesor melihat rekaman beserta waktu server, jarak ke titik proyek, dan penanda di luar radius. Asesmen contoh sudah memiliki satu jendela yang sedang terbuka.
11. Pengingat survei dapat dicoba tanpa menunggu pukul 08.00 WIB dengan perintah `php artisan nscas:survey-reminders` di terminal; surelnya masuk ke kotak surat uji.
12. Tahap 3 pada asesmen contoh "Proyek Gedung 2026" (status Validasi), dengan akun asesor utama:
   - Mutu data: partisipasi per strata beserta alasan tertulis, alfa Cronbach, rwg per unit, dan jawaban bertanda; coba keluarkan satu jawaban dengan alasan lalu pulihkan.
   - Temuan awal: rata-rata per karakteristik dan kelompok jabatan, selisih persepsi, dan usulan karakteristik fokus.
   - Wawancara dan diskusi kelompok: saring sesi menurut status, buka satu sesi, isi nilai dan dasar penilaian, tambah narasumber, lalu ubah status menjadi Selesai. Tambah sesi baru dari tombol Tambah sesi, dan ubah panduan pertanyaan.
   - Bukti dokumen: tandai bukti satu karakteristik sudah ditinjau.
   - Pada asesmen "Kantor Pusat 2026" (status Pengumpulan data), tombol Buat sesi dari usulan menyusun sesi dari rencana sampel, dan tombol Tutup survei sekarang ada di halaman Responden. Dengan akun administrator klien, tombol surat pada daftar Penilaian mandiri mengirim tautan lewat surel ke kotak surat uji.
13. Tahap 4 pada asesmen contoh "Perdana" (status Penilaian, organisasi PT Infrastruktur Lain), dengan akun asesor: buka Penilaian asesor, pilih satu karakteristik, baca sumber datanya, lalu beri nilai dan alasan; nilai asesor lain baru tampil setelah Anda menyimpan nilai sendiri. Dengan akun asesor utama: isi jalur setara, lalu Jalankan perhitungan. Rapat panel yang sudah ditetapkan dapat dilihat pada asesmen "2025" (status Pemantauan).
14. Dasbor hasil pada asesmen "2025" dengan akun administrator klien atau peninjau eksekutif: kartu indeks dan tingkat, batang per aspek dan karakteristik, peta warna per strata dan unit, analisis kepekaan bobot, dan tombol Unduh Excel. Akun koordinator unit hanya melihat unitnya pada peta per unit. Perbandingan antarperiode ada di tahap 6.
15. Rencana aksi pada asesmen "2025": halaman Kesenjangan dan rencana aksi memuat kesenjangan berurutan dengan analisis penyebab dan tindakan; halaman Pemantauan rencana aksi di tahap 6 memuat kemajuan per triwulan, verifikasi asesor, dan tinjauan triwulan. Pengingat tenggat dapat dicoba dengan `php artisan nscas:action-reminders`; surelnya masuk ke kotak surat uji.
16. Laporan pada asesmen "2025": buka Pratinjau setiap jenis laporan, buka versi yang sudah ditandatangani, dan unduh PDF-nya (PDF dibuat Chromium di codespace bila `PDF_CHROMIUM_EXECUTABLE` diisi; bila kosong, cetak dari peramban). Halaman Komunikasi hasil memuat catatan penyampaian kepada pekerja.
17. Jejak audit pada asesmen mana pun, dari pusat asesmen (Lintas tahap): saring menurut kategori dan tanggal, buka Rincian perubahan, dan unduh CSV dengan akun asesor utama. Akun administrator klien melihat ringkasan tanpa isi perubahan.
18. Dengan akun pengelola sistem: halaman Retensi data memuat masa simpan setiap asesmen yang hasilnya sudah ditetapkan; tombol pemusnahan baru muncul untuk asesmen Diarsipkan yang masa simpannya berakhir, sehingga pada data contoh baru berupa daftar. Halaman Status sistem memuat dua puluh peristiwa akses terakhir. Tugas penanda masa simpan dapat dicoba dengan `php artisan nscas:retention-check`.
19. Keamanan masuk: lima kali salah kata sandi mengunci akun selama 15 menit. Akun Nusa Safety (pengelola sistem, asesor utama, asesor) keluar otomatis setelah 30 menit tanpa aktivitas, dan semua akun setelah 8 jam.
20. Tampilan konsol di telepon, tablet, dan laptop. Buka alamat yang sama dari peramban perangkat itu; tab tahap pengumpulan data dapat digeser ke samping di layar sempit.

Asesmen contoh "Divisi Infrastruktur 2026" sengaja dibiarkan setengah lengkap untuk mencoba alur perencanaan. Seluruh modul sudah dibangun ulang; fase R12 berisi uji menyeluruh dan persiapan penempatan.

Di lingkungan ini verifikasi dua langkah tidak diwajibkan, agar keenam akun contoh dapat langsung dicoba. Untuk mencoba alur wajibnya, buka berkas `.env` di codespace, ubah `NSCAS_ENFORCE_TWO_FACTOR=false` menjadi `true`, lalu jalankan `bash .devcontainer/start.sh --restart` di terminal. Siapkan aplikasi autentikator di telepon, misalnya Google Authenticator atau Microsoft Authenticator. Di produksi nilai ini wajib `true`.

## 5. Memperbarui ke versi terbaru

Setiap kali fase baru selesai dan dikirim ke GitHub, codespace yang sudah ada dapat diperbarui tanpa dibuat ulang. Buka terminal di codespace (menu Terminal, New Terminal), lalu jalankan:

```bash
bash .devcontainer/update.sh
```

Skrip mengambil kode terbaru, memasang dependensi, memperbarui basis data, membangun aset, lalu menyalakan ulang aplikasi. Data yang sudah dibuat di codespace tetap ada. Bila fase baru menambah data contoh, jalankan `bash .devcontainer/update.sh --demo`. Pilihan ini mengembalikan status asesmen contoh ke nilai awalnya, dengan kata sandi akun yang sama.

Cara lain yang paling bersih: hapus codespace, lalu buat yang baru (bagian 2).

## 6. Menghentikan, menyalakan kembali, dan menghapus

1. Menghentikan: buka `https://github.com/codespaces`, klik tanda tiga titik pada codespace, pilih Stop codespace. Codespace yang berhenti tidak memakai kuota jam inti, tetapi tetap memakai kuota penyimpanan.
2. Menyalakan kembali: buka codespace yang sama dari `https://github.com/codespaces`. Basis data, aplikasi, dan worker antrean menyala otomatis dalam sekitar satu menit. Periksa kembali status Public port 8000.
3. Menghapus: pilih Delete pada codespace setelah uji coba selesai. Seluruh data uji coba ikut terhapus.

## 7. Pemecahan masalah

| Gejala | Tindakan |
|---|---|
| Alamat aplikasi menampilkan galat 502 atau tidak terbuka | Penyiapan belum selesai, atau aplikasi belum menyala. Periksa `.codespace/logs/setup.log` dan `.codespace/logs/app.log`. Untuk menyalakan ulang, jalankan `bash .devcontainer/start.sh --restart` di terminal. |
| Peramban meminta masuk ke GitHub saat membuka alamat aplikasi | Port 8000 masih Private. Ubah menjadi Public (bagian 3 langkah 2). |
| Setelah masuk, peramban pindah ke alamat `localhost` | Alamat codespace di `.env` tidak sesuai. Jalankan `bash .devcontainer/start.sh --restart`; skrip menyelaraskan alamat dengan nama codespace. |
| Halaman menampilkan pesan sesi berakhir | Sesi berakhir setelah 30 menit tidak aktif (docs/04). Muat ulang halaman, lalu masuk kembali. |
| Lupa kata sandi akun contoh | Lihat `.codespace/akun-uji-coba.txt`, atau pakai Lupa kata sandi di halaman masuk dan buka surelnya di kotak surat uji. |
| Halaman galat 500 | Baca `storage/logs/laravel.log` di codespace, lalu sampaikan isinya kepada pengembang. |
| Ingin mengulang dari awal | Hapus codespace, lalu buat codespace baru (bagian 2). |

## 8. Cara kerja

| Berkas | Fungsi |
|---|---|
| `.devcontainer/devcontainer.json` | Susunan codespace: layanan, port yang diteruskan, GitHub CLI, dan urutan skrip |
| `.devcontainer/compose.yaml` | Tiga layanan dalam satu ruang jaringan: ruang kerja (PHP dan Node), PostgreSQL 16, dan Mailpit |
| `.devcontainer/Dockerfile` | Image ruang kerja: PHP 8.3 dengan ekstensi yang sama dengan image produksi, Node 22, dan klien PostgreSQL |
| `.devcontainer/setup.sh` | Penyiapan sekali: dependensi, `.env` dengan kunci acak, migrasi, data contoh dengan kata sandi acak, build aset |
| `.devcontainer/start.sh` | Setiap codespace menyala: menyelaraskan alamat publik, lalu menyalakan aplikasi, worker antrean, dan penjadwal |
| `.devcontainer/ports.sh` | Membuka port 8000 untuk umum dengan GitHub CLI |
| `.devcontainer/update.sh` | Memperbarui codespace ke versi terbaru di GitHub |

Penerus port Codespaces menerima permintaan HTTPS di alamat publik, lalu meneruskannya ke aplikasi sebagai HTTP. Dalam perjalanan itu header Host dapat diganti menjadi `localhost`, sedangkan alamat publik dikirim lewat header X-Forwarded-Host dan X-Forwarded-Proto. Tiga pengaturan menjaga aplikasi tetap benar di balik penerus tersebut, tanpa mengubah perilaku produksi:

1. `TRUSTED_PROXIES=*` membuat aplikasi membaca alamat publik dan skema HTTPS dari header penerus, sehingga pengalihan dan tautan memakai alamat publik. Nilai ini aman di Codespaces karena aplikasi hanya dapat dijangkau lewat penerus port. Di server produksi, isinya alamat atau rentang penyeimbang beban (docs/08).
2. `APP_URL` berisi alamat publik codespace, sehingga tautan di surel memakai alamat yang benar. `start.sh` menyelaraskan nilainya setiap kali codespace menyala.
3. `SESSION_SECURE_COOKIE=true` membuat kuki sesi hanya dikirim lewat HTTPS.

Perlindungan formulir dari pemalsuan permintaan memeriksa header Sec-Fetch-Site dari peramban, lalu token sesi bila header itu tidak ada. Keduanya tidak terpengaruh oleh penggantian header Origin oleh penerus port, yang pada versi 1 menyebabkan galat saat masuk.

## 9. Hasil verifikasi saat penyusunan (19 November 2026)

Codespaces sungguhan tidak dapat dibuat dari lingkungan penyusunan. Karena itu konfigurasi diuji dengan meniru Codespaces di mesin uji:

1. Image ruang kerja dibangun dari `.devcontainer/Dockerfile`.
2. Ketiga layanan dijalankan dari `.devcontainer/compose.yaml`.
3. `setup.sh` dijalankan utuh sebagai pengguna `vscode` pada salinan repositori yang bersih.
4. Penerus port ditiru dengan proksi HTTPS di `https://localhost:18443`. Proksi itu mengganti Host menjadi `localhost:8000`, mengirim alamat publik lewat X-Forwarded-Host, X-Forwarded-Proto, dan X-Forwarded-Port, serta mengganti Origin menjadi `http://localhost:8000`. Ini varian terburuk yang teramati pada versi 1.
5. Uji peramban (Chromium) dijalankan lima kali berturut-turut, dan semuanya lulus.

| Pemeriksaan | Hasil |
|---|---|
| Image ruang kerja: PHP 8.3 dengan `pdo_pgsql`, `intl`, `gd`, `zip`, `bcmath`, `pcntl`, OPcache, serta Node 22 | Lulus, setelah perbaikan butir 1 di bawah |
| PostgreSQL, Mailpit, dan ruang kerja menyala sehat; PostgreSQL hanya mendengar di localhost | Lulus |
| `setup.sh` utuh: migrasi, seed, data contoh, build aset, aplikasi dan worker menyala | Lulus, 20 detik di luar waktu unduh dependensi |
| `.env` dan berkas akun ber-mode 600 dan diabaikan git; kata sandi tidak tercatat di log mana pun | Lulus |
| Alamat akar dialihkan ke halaman masuk di alamat publik | Lulus, setelah perbaikan butir 2 di bawah |
| Masuk sebagai asesor utama dan tiba di beranda pada alamat publik, walaupun Origin diganti penerus | Lulus |
| Kuki sesi bertanda Secure, dan header HSTS dikirim karena skema HTTPS terbaca | Lulus |
| Pusat asesmen dan ringkasan asesmen terbuka | Lulus |
| Surel atur ulang kata sandi diterima Mailpit, dan tautannya memakai alamat publik | Lulus |
| Akun peninjau eksekutif masuk dari layar telepon 390 piksel tanpa geser ke samping | Lulus |
| Tidak ada galat di konsol peramban dan tidak ada permintaan ke host lain | Lulus |
| `start.sh` mendeteksi alamat publik yang berubah, memperbarui `.env` dan berkas akun, lalu menyalakan ulang | Lulus |
| Codespace dihentikan lalu dinyalakan kembali: aplikasi siap dalam 3 detik dan data tetap ada | Lulus |

Dua cacat ditemukan dan diperbaiki selama pengujian:

1. Image dasar `mcr.microsoft.com/devcontainers/php` membawa sumber paket Yarn yang kunci tanda tangannya sudah tidak berlaku. Akibatnya `apt-get update` gagal dan codespace tidak dapat dibuat. Sumber itu kini dihapus di `.devcontainer/Dockerfile`, karena proyek ini tidak memakai Yarn.
2. Nilai `TRUSTED_PROXIES` dibaca di `bootstrap/app.php` sebelum `.env` dimuat. Nilai yang ditulis di `.env` diabaikan tanpa pesan galat, sehingga setelah masuk peramban dialihkan ke `http://localhost:8000`. Selain itu, nilai `*` tidak dikenali. Pengaturan kini dibaca dari `config/trustedproxy.php` pada setiap permintaan dan dijaga oleh `tests/Feature/TrustedProxiesTest.php`. Di server produksi berbasis Docker, nilai ini sudah dikirim sebagai variabel lingkungan sistem (`env_file`), sehingga perilaku produksi tidak berubah.

Yang belum dapat diverifikasi karena memerlukan codespace sungguhan:

1. Unduhan dependensi Composer dari internet. Jaringan lingkungan uji menolak unduhan paket dari api.github.com, sehingga folder `vendor` diisi dari salinan lokal. Dependensi npm diunduh dari internet dan lulus. Langkah `composer install` yang sama berjalan di GitHub Actions pada setiap pengiriman kode.
2. Pemasangan GitHub CLI melalui fitur devcontainer, dan pembukaan port 8000 menjadi Public oleh `ports.sh`. Bila gagal, ubah manual (bagian 3 langkah 2).
3. Waktu penyiapan pada mesin 2 inti. Perkiraannya 10 sampai 15 menit, sebagian besar untuk membangun image dan mengunduh dependensi.
4. Header persis yang dikirim penerus port GitHub saat ini. Tiruan memakai varian terburuk yang teramati pada versi 1.

## Rujukan

GitHub. (2026). *GitHub Codespaces billing*. GitHub Docs. https://docs.github.com/en/billing/concepts/product-billing/github-codespaces

Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. (2022). Lembaran Negara Republik Indonesia Tahun 2022 Nomor 196.
