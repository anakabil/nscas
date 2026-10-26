# 09. Uji Coba di GitHub Codespaces

Dokumen ini menjelaskan lingkungan uji coba NSCAS di GitHub Codespaces. Lingkungan ini dipakai selama klien belum memberi kepastian, untuk latihan tim Nusa Safety dan demonstrasi kepada calon klien. Lingkungan ini bukan produksi. Penempatan produksi tetap mengikuti docs/08.

## 1. Batasan yang wajib dipatuhi

1. Hanya data demo fiktif. Server Codespaces berada di luar Indonesia (wilayah terdekat Asia Tenggara, Singapura). Data pekerja sungguhan tidak boleh dimasukkan, sesuai CLAUDE.md aturan 7 dan komitmen lokasi data dalam proposal. UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 56, juga mensyaratkan pelindungan setara bila data pribadi dikirim ke luar wilayah hukum Indonesia.
2. Hasil di lingkungan ini adalah contoh tampilan, bukan hasil pengukuran, dan bukan sertifikat Safety Culture Ladder.
3. Codespace mati otomatis setelah 30 menit tidak dipakai. Batas ini dapat diubah sampai 240 menit di github.com, Settings, Codespaces, Default idle timeout. Data tetap tersimpan sampai codespace dihapus. Codespace yang berhenti lama dihapus otomatis oleh GitHub sesuai pengaturan Default retention period.
4. Kuota gratis akun GitHub pribadi saat dokumen ini ditulis adalah 120 jam inti dan 15 GB penyimpanan per bulan. Mesin 2 inti setara sekitar 60 jam pemakaian per bulan. Periksa sisa kuota di github.com, Settings, Billing and plans.
5. Surel undangan dan pengingat tidak terkirim ke luar. Semuanya ditampung di kotak surat uji (Mailpit).
6. Alamat aplikasi berbentuk `https://<nama-codespace>-3000.app.github.dev` dan berubah bila codespace baru dibuat.

## 2. Membuat codespace (sekali)

1. Buka `https://github.com/anakabil/nscas` dan masuk dengan akun GitHub.
2. Klik tombol hijau Code, pilih tab Codespaces, klik tanda tiga titik, lalu New with options.
3. Pilih cabang `claude/great-pasteur-31n82q`, Region Southeast Asia, dan Machine type 2-core. Klik Create codespace.
4. Editor VS Code terbuka di peramban. Penyiapan berjalan otomatis sekitar 15 menit: memasang dependensi dan Chromium untuk PDF, membuat rahasia acak, menyiapkan basis data, mengisi data demo PT Contoh Konstruksi, lalu membangun dan menyalakan aplikasi. Kemajuannya dapat dilihat di berkas `.codespace/logs/setup.log`.
5. Penyiapan selesai bila log menampilkan "Penyiapan selesai".

## 3. Membuka aplikasi

1. Buka berkas `.codespace/akun-uji-coba.txt` dari panel Explorer di kiri. Berkas ini berisi alamat aplikasi, akun administrator, dan lima akun demo beserta kata sandinya. Berkas ini tidak pernah dikomit ke repositori.
2. Buka tab Ports di bagian bawah editor. Port 3000 (NSCAS) dan 9100 (Berkas NSCAS) harus berstatus Public. Bila masih Private, klik kanan port tersebut, pilih Port Visibility, lalu Public. Port 9100 wajib Public agar unggah dan unduh berkas bukti berjalan.
3. Buka alamat aplikasi. Saat masuk pertama, setiap akun diminta mengaktifkan verifikasi dua langkah. Siapkan aplikasi autentikator di telepon, misalnya Google Authenticator atau Microsoft Authenticator, lalu pindai kode QR yang tampil. Simpan kode cadangan yang diberikan.
4. Surel undangan dan pengingat dapat dilihat dengan membuka port 8025 (Kotak surat uji) dari tab Ports. Port ini tetap Private, hanya untuk pemilik codespace.

## 4. Demonstrasi kepada klien

1. Data demo berisi satu asesmen PT Contoh Konstruksi pada tahap rencana aksi: 12 lokasi, 40 proyek, 3.000 responden fiktif, 900 respons survei, penilaian mandiri, bukti contoh, penilaian dua asesor, sesi validasi, dan hasil mesin penilaian.
2. Akun yang paling sesuai untuk demonstrasi adalah `asesor.utama@demo.nusasafety.test` untuk alur kerja asesor, dan `direksi@contoh-konstruksi.test` untuk tampilan pimpinan klien.
3. Bila klien akan mencoba sendiri, aktifkan dulu verifikasi dua langkah akun yang akan dipinjamkan, atau lakukan demonstrasi melalui berbagi layar.
4. Bagikan alamat aplikasi hanya kepada peserta demonstrasi. Walaupun datanya fiktif, alamat ini terbuka untuk siapa pun yang mengetahuinya selama codespace menyala.

## 5. Menghentikan, menyalakan kembali, dan menghapus

1. Menghentikan: buka `https://github.com/codespaces`, klik tanda tiga titik pada codespace, pilih Stop codespace. Codespace yang berhenti tidak memakai kuota jam inti, tetapi tetap memakai kuota penyimpanan.
2. Menyalakan kembali: buka codespace yang sama dari `https://github.com/codespaces`. Layanan, aplikasi, dan worker menyala otomatis dalam sekitar satu menit. Periksa kembali status Public port 3000 dan 9100.
3. Menghapus: pilih Delete pada codespace setelah uji coba selesai. Seluruh data uji coba ikut terhapus.

## 6. Pemecahan masalah

| Gejala | Tindakan |
|---|---|
| Halaman masuk menampilkan "Application error: a server-side exception has occurred" dengan Digest berakhiran `@E80` | Alamat codespace di `.env` tidak sesuai, sehingga formulir ditolak. Jalankan `git pull` lalu `bash .devcontainer/start.sh` di terminal codespace. Skrip menyelaraskan alamat dan menyalakan ulang aplikasi. |
| Alamat aplikasi menampilkan galat 502 | Penyiapan atau aplikasi belum selesai menyala. Periksa `.codespace/logs/setup.log` dan `.codespace/logs/app.log`. Untuk menyalakan ulang, jalankan `bash .devcontainer/start.sh` di terminal. |
| Peramban meminta masuk ke GitHub saat membuka alamat aplikasi | Port 3000 masih Private. Ubah menjadi Public (bagian 3 langkah 2). |
| Unggah bukti gagal atau unduhan bukti tidak terbuka | Port 9100 masih Private. Ubah menjadi Public. |
| Laporan PDF tidak kunjung tersedia | Worker belum berjalan. Periksa `.codespace/logs/worker.log`, lalu jalankan `bash .devcontainer/start.sh`. |
| Ingin mengulang dari awal | Hapus codespace, lalu buat codespace baru (bagian 2). |

## 7. Cara kerja

| Berkas | Fungsi |
|---|---|
| `.devcontainer/devcontainer.json` | Image Node.js 22, Docker di dalam codespace, GitHub CLI, port yang diteruskan, dan urutan skrip |
| `.devcontainer/setup.sh` | Penyiapan sekali: dependensi, Chromium, `.env` dengan rahasia acak, layanan pendukung, migrasi, seed, data demo, build produksi |
| `.devcontainer/start.sh` | Setiap codespace menyala: layanan pendukung, `next start`, dan worker pg-boss |
| `.devcontainer/ports.sh` | Membuka port 3000 dan 9100 untuk umum dengan GitHub CLI |
| `.devcontainer/docker-compose.codespaces.yml` dan `storage-proxy.Caddyfile` | Proksi MinIO di port 9100 |

Penerus port Codespaces dapat mengganti header Host menjadi `localhost`. Tiga penyesuaian menjaga aplikasi tetap benar di balik penerus tersebut, tanpa mengubah perilaku produksi:

1. `SERVER_ACTIONS_ALLOWED_ORIGINS` di `next.config.ts` mengizinkan alamat publik codespace dan `localhost:3000` memanggil Server Actions. Penerus port dapat mengganti header Origin menjadi `localhost:3000` sambil mengirim alamat publik lewat X-Forwarded-Host, atau mengganti Host sambil membiarkan Origin. Tanpa variabel ini, Next.js menolak formulir karena kedua header berbeda (galat E80). Di produksi variabel ini kosong. `start.sh` menyelaraskan nilainya dengan nama codespace setiap kali menyala.
2. Proksi MinIO mengembalikan Host ke alamat publik sebelum meneruskan permintaan, karena URL unggah dan unduh bukti ditandatangani untuk alamat publik. Proksi ini juga menetapkan header CORS ke asal aplikasi, karena Origin yang diterima MinIO dapat sudah diganti penerus port.
3. Rute kode QR (`src/app/q/[code]/route.ts`) mengalihkan dengan alamat relatif, sehingga peramban tetap berada di alamat publik.

`AUTH_URL` dan `APP_URL` diisi alamat publik codespace, sehingga Auth.js dan tautan di surel memakai alamat yang benar.

## 8. Hasil verifikasi saat penyusunan (24 Oktober 2026)

Konfigurasi ini diuji di lingkungan pengembangan dengan meniru Codespaces. Tiruan itu memakai penerus port HTTPS yang mengganti Host dan X-Forwarded-Host menjadi `localhost`. Nama `cs-3000.app.github.dev` dan `cs-9100.app.github.dev` diarahkan ke mesin uji. `setup.sh` dijalankan utuh pada salinan repositori terpisah, kecuali pemasangan Chromium, karena repositori paket Debian diblokir di lingkungan pengembangan. Penyiapan selesai dalam sekitar 3 menit: data demo sekitar 35 detik, build produksi sekitar 1 menit.

| Pemeriksaan melalui penerus port tiruan | Hasil |
|---|---|
| Halaman masuk terbuka | Lulus |
| Masuk (Server Action) diterima dan pengalihan tetap di alamat publik | Lulus |
| Aktivasi verifikasi dua langkah (Server Action) | Lulus |
| Unduhan bukti dialihkan ke alamat berkas publik, dan URL bertanda tangan diterima MinIO | Lulus |
| Unggah PUT bertanda tangan dari halaman aplikasi (CORS, CSP `connect-src`, Host) | Lulus |
| Pengalihan rute kode QR tetap di alamat publik | Lulus |
| Tidak ada pelanggaran CSP atau CORS di konsol peramban | Lulus |
| `.env` dan berkas akun ber-mode 600, diabaikan git; tidak ada rahasia di log penyiapan, aplikasi, atau worker | Lulus |

Uji pembanding membuktikan kedua penyesuaian memang diperlukan:

1. Tanpa `SERVER_ACTIONS_ALLOWED_ORIGINS`, Next.js menolak masuk dengan galat "Invalid Server Actions request".
2. URL bertanda tangan yang dikirim langsung ke MinIO tanpa proksi ditolak dengan `SignatureDoesNotMatch`.

Variabel itu dibaca saat aplikasi dinyalakan, jadi perubahannya tidak memerlukan build ulang.

Pembaruan 26 Oktober 2026. Di codespace sungguhan, masuk ditolak dengan galat E80 walaupun alamat di `.env` sudah benar. Galat yang sama dapat direproduksi dengan penerus tiruan yang mengirim alamat publik lewat X-Forwarded-Host dan mengganti Origin menjadi `localhost:3000`. Setelah `localhost:3000` ditambahkan ke daftar asal, seluruh pemeriksaan di atas lulus pada varian penerus ini dan pada varian sebelumnya. Jalur pembaruan juga sudah diuji: `git pull` lalu `bash .devcontainer/start.sh`. Skrip mendeteksi nilai lama, memperbaruinya, lalu menyalakan ulang aplikasi, worker, dan proksi berkas.

Yang belum dapat diverifikasi karena memerlukan codespace sungguhan:

1. Pengubahan port menjadi Public oleh `ports.sh` melalui GitHub CLI. Bila gagal, ubah manual (bagian 3 langkah 2).
2. Pemasangan Chromium dengan `--with-deps` di image codespace, beserta render PDF laporan.
3. Waktu penyiapan pada mesin 2 inti. Diperkirakan sekitar 15 menit, karena npm dan build lebih lambat daripada di mesin uji.
