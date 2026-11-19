# 08. Penempatan di DigitalOcean (Singapura)

Panduan ini menjelaskan cara memasang NSCAS versi 2 di DigitalOcean wilayah Singapura (`sgp1`). Panduan versi 1 untuk VPS berpusat data Indonesia tersimpan di riwayat Git pada komit `8ad6b3d`.

Semua langkah dijalankan oleh pemilik akun DigitalOcean atau administrator yang ditunjuk. Tidak ada langkah di panduan ini yang dijalankan otomatis dari repositori.

## 1. Sebelum mulai

### 1.1 Syarat lokasi data

DigitalOcean tidak memiliki pusat data di Indonesia. Sebelum ada data responden nyata di server ini, syarat pada `docs/04` bagian 1.1 wajib terpenuhi: persetujuan tertulis klien atas lokasi Singapura, perjanjian pemrosesan data yang menyebut lokasi dan penyedia, dan dasar transfer data ke luar negeri yang terdokumentasi. Sebelum itu, server hanya boleh dipakai untuk uji coba dengan data buatan.

### 1.2 Berkas yang tersedia

| Berkas | Fungsi |
|---|---|
| `Dockerfile` | Membangun satu image berisi aplikasi dan server web FrankenPHP |
| `docker-compose.prod.yml` | Layanan produksi: `app` (web), `worker` (antrean), `scheduler` (penjadwal), `migrate`, dan `postgres` pada profil `single` |
| `docker-compose.yml` | Layanan pengembangan saja: PostgreSQL, MinIO, Mailpit |
| `deploy/digitalocean/cloud-init.yaml` | Penyiapan Droplet saat pertama menyala |
| `deploy/digitalocean/deploy.sh` | Memasang versi baru, memeriksa kesehatan, dan mengembalikan versi sebelumnya |
| `deploy/digitalocean/backup.sh` | Cadangan harian terenkripsi dan uji pemulihan (tata letak A) |
| `deploy/digitalocean/.env.production.example` | Templat variabel produksi tanpa nilai rahasia |

### 1.3 Status verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Sintaks `deploy.sh` dan `backup.sh` | Lulus (`bash -n`) |
| Berkas `cloud-init.yaml` dan kedua berkas compose | Sah; `docker compose config` lulus untuk keduanya |
| Dockerfile | Lulus pemeriksaan `docker buildx build --check` tanpa peringatan |
| Membangun image penuh dan menjalankannya | Belum. Lingkungan penyusunan membatasi akses jaringan dari dalam proses build, sehingga tidak dapat diuji di sana |
| Penempatan ke Droplet sungguhan | Belum. Tidak ada akun DigitalOcean yang dipakai saat penyusunan |

Karena dua butir terakhir belum diuji, penempatan pertama harus diperlakukan sebagai uji: pakai tata letak A dengan data buatan, dan jalankan daftar periksa bagian 12 sebelum dipakai klien.

## 2. Tiga tata letak

Server aplikasi tidak menyimpan keadaan. Sesi, cache, dan antrean ada di PostgreSQL, dan berkas ada di penyimpanan objek. Karena itu ukuran server dapat dinaikkan, dan jumlah server dapat ditambah, tanpa mengubah aplikasi. Inilah yang dimaksud elastis.

| Tata letak | Susunan | Dipakai untuk | Cara menambah kapasitas |
|---|---|---|---|
| A. Satu Droplet | Aplikasi, antrean, penjadwal, dan PostgreSQL dalam satu Droplet | Uji coba dan demo dengan data buatan | Ubah ukuran Droplet (resize) |
| B. Produksi awal | Satu Droplet untuk aplikasi; DigitalOcean Managed PostgreSQL; Spaces untuk berkas | Pengukuran sungguhan sampai sekitar 3.000 responden | Ubah ukuran Droplet dan basis data secara terpisah |
| C. Produksi elastis | Load Balancer di depan beberapa Droplet web dalam Autoscale Pool; satu Droplet untuk antrean dan penjadwal; Managed PostgreSQL; Spaces | Banyak klien atau jendela survei bersamaan | Pool menambah dan mengurangi Droplet web menurut beban |

```
Tata letak A                  Tata letak B                       Tata letak C

Internet                      Internet                           Internet
   |                             |                                  |
Droplet                       Droplet                           Load Balancer (TLS)
 - app (TLS otomatis)          - app (TLS otomatis)              /      |      \
 - worker                      - worker                       web     web     web   (Autoscale Pool)
 - scheduler                   - scheduler                       \      |      /
 - postgres                        |          \                Droplet kerja: worker, scheduler
                              Managed          Spaces               |             \
                              PostgreSQL                        Managed            Spaces
                                                                PostgreSQL
```

Urutan yang disarankan: mulai dari A untuk uji coba, pindah ke B sebelum pengukuran pertama, dan pindah ke C hanya bila uji beban atau pemakaian nyata menunjukkan satu Droplet tidak cukup.

## 3. Ukuran server

Angka berikut adalah titik awal untuk lingkup 3.000 responden dengan sekitar 300 pengisian survei bersamaan. Angka ini belum diuji pada versi 2. Uji beban dijadwalkan pada fase R12, dan ukuran final ditetapkan dari hasilnya.

| Komponen | Uji coba (A) | Produksi awal (B) |
|---|---|---|
| Droplet aplikasi | 2 vCPU, 4 GB memori | 4 vCPU, 8 GB memori |
| Basis data | Di dalam Droplet | Managed PostgreSQL 2 vCPU, 4 GB memori, dengan simpul cadangan bila anggaran memungkinkan |
| Penyimpanan berkas | Belum diperlukan | Satu bucket Spaces privat |
| Cadangan | `backup.sh` ke bucket Spaces terpisah | Cadangan harian dan pemulihan ke titik waktu bawaan Managed PostgreSQL |

Harga DigitalOcean berubah dari waktu ke waktu. Periksa halaman harga resminya saat membuat sumber daya; panduan ini sengaja tidak mencantumkan harga.

## 4. Tata letak A, langkah demi langkah

1. Di panel DigitalOcean, tambahkan kunci SSH milik administrator pada menu Settings, Security.
2. Buat Droplet: wilayah Singapore (SGP1), Ubuntu 24.04 LTS, ukuran sesuai bagian 3, pilih kunci SSH tadi, dan aktifkan Monitoring.
3. Pada kolom User data, tempel seluruh isi `deploy/digitalocean/cloud-init.yaml`. Berkas ini tidak memuat rahasia.
4. Tunggu sekitar lima menit. Server memperbarui paket, memasang Docker, membuat pengguna `deploy`, mematikan login kata sandi dan login root, menyalakan firewall (hanya port 22, 80, 443), fail2ban, dan pembaruan keamanan otomatis.
5. Arahkan DNS: buat rekaman A untuk `nscas.nusasafety.co.id` ke alamat IP Droplet. Tunggu sampai `dig +short nscas.nusasafety.co.id` menampilkan alamat itu.
6. Masuk ke server: `ssh deploy@<alamat IP>`. Pastikan berkas `/var/lib/nscas-bootstrap.done` ada. Bila belum, baca `/var/log/nscas-bootstrap.log`.
7. Ambil kode: `git clone https://github.com/anakabil/nscas.git /opt/nscas/app`.
8. Siapkan variabel: `cp /opt/nscas/app/deploy/digitalocean/.env.production.example /opt/nscas/.env`, lalu `chmod 600 /opt/nscas/.env`, lalu isi dengan `nano /opt/nscas/.env`.

| Variabel | Isi pada tata letak A |
|---|---|
| `APP_KEY` | Hasil `echo "base64:$(openssl rand -base64 32)"`. Simpan salinannya di pengelola kata sandi |
| `APP_URL` | `https://nscas.nusasafety.co.id` |
| `SERVER_NAME` | `nscas.nusasafety.co.id` |
| `COMPOSE_PROFILES` | `single` |
| `DB_HOST`, `DB_PORT`, `DB_SSLMODE` | `postgres`, `5432`, `prefer` |
| `DB_DATABASE`, `DB_USERNAME` | `nscas`, `nscas` |
| `DB_PASSWORD` | Kata sandi acak panjang, misalnya hasil `openssl rand -base64 24` |
| `MAIL_*` | Lihat bagian 9 |

9. Pasang: `/opt/nscas/app/deploy/digitalocean/deploy.sh deploy`. Skrip memeriksa berkas variabel, membangun image, menjalankan migrasi, menyalakan layanan, dan menunggu sampai sehat. Bila gagal, skrip mengembalikan versi sebelumnya dan menampilkan sebabnya.
10. Isi data awal: `deploy.sh artisan db:seed --force`. Perintah ini hanya membuat organisasi Nusa Safety, tanpa akun.
11. Buat pengelola sistem pertama: `deploy.sh artisan nscas:create-admin nama@nusasafety.co.id`. Kata sandi acak tampil satu kali di terminal. Catat, lalu segera masuk, ganti kata sandi, dan aktifkan verifikasi dua langkah.
12. Periksa: buka `https://nscas.nusasafety.co.id`. Sertifikat TLS diterbitkan otomatis oleh server web saat domain pertama kali diakses. Halaman Status sistem harus menunjukkan basis data dan antrean berfungsi.

## 5. Tata letak B

Sama dengan tata letak A, dengan perbedaan berikut.

1. Buat Managed PostgreSQL versi 16 di wilayah SGP1. Pada Trusted sources, izinkan hanya Droplet aplikasi. Buat basis data dan pengguna `nscas`.
2. Buat bucket Spaces privat di SGP1, dan kunci akses yang dibatasi hanya untuk bucket itu.
3. Di `/opt/nscas/.env`: kosongkan `COMPOSE_PROFILES`; isi `DB_HOST`, `DB_PORT` (biasanya 25060), `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` dari halaman basis data; biarkan `DB_SSLMODE=require`.
4. Variabel `AWS_*` untuk Spaces diisi sekarang, tetapi `FILESYSTEM_DISK` tetap `local` sampai modul bukti dan laporan dibangun (fase R5 dan R10). Pada fase R0 aplikasi belum menyimpan berkas.
5. Cadangan memakai fitur Managed PostgreSQL. `backup.sh` otomatis tidak melakukan apa pun pada tata letak ini.

Pindah dari A ke B: buat cadangan dengan `backup.sh`, pulihkan ke Managed PostgreSQL dengan `pg_restore`, ubah variabel `DB_*`, lalu jalankan `deploy.sh deploy`.

## 6. Tata letak C

1. Siapkan tata letak B lebih dulu dan pastikan berjalan baik.
2. Buat Load Balancer di SGP1 dengan sertifikat TLS untuk domain, meneruskan HTTPS 443 ke port 80 Droplet (yang dipetakan ke port 8080 di dalam kontainer), dengan pemeriksaan kesehatan ke `/up`.
3. Pada Droplet web: `SERVER_NAME=:8080`, `TRUSTED_PROXIES` diisi rentang alamat VPC, `NSCAS_SERVICES=app`, dan `NSCAS_SKIP_MIGRATE=1`.
4. Satu Droplet kerja menjalankan `NSCAS_SERVICES="worker scheduler"` dan menjalankan migrasi. Penjadwal hanya boleh berjalan di satu server.
5. Buat Autoscale Pool dari citra Droplet web dengan batas minimal dua dan batas maksimal sesuai anggaran. Semua server memakai `APP_KEY` yang sama.
6. Arahkan DNS ke Load Balancer, lalu tutup port 80 dan 443 Droplet dari internet dengan Cloud Firewall sehingga hanya Load Balancer yang dapat menjangkaunya.

Tata letak ini memerlukan image yang dibangun sekali dan ditarik oleh semua server (variabel `NSCAS_IMAGE`). Rinciannya disusun pada fase R12 bersama uji beban.

## 7. Memperbarui versi dan kembali ke versi sebelumnya

| Keperluan | Perintah di server |
|---|---|
| Memasang versi baru | `deploy.sh deploy <tag atau cabang>` |
| Melihat versi aktif dan keadaan layanan | `deploy.sh status` |
| Kembali ke versi sebelum penempatan terakhir | `deploy.sh rollback` |
| Menjalankan perintah aplikasi | `deploy.sh artisan <perintah>` |
| Membaca log | `deploy.sh compose logs --tail 200 app` |

Pada tata letak A, skrip membuat cadangan basis data sebelum migrasi. `rollback` mengembalikan image aplikasi, tetapi tidak membatalkan migrasi basis data. Bila sebuah versi mengubah skema dan harus dibatalkan, pulihkan basis data dari cadangan yang dibuat sebelum penempatan itu.

## 8. Cadangan dan uji pemulihan (tata letak A)

1. Di laptop administrator, buat pasangan kunci: `age-keygen -o nscas-backup.key`. Simpan berkas kunci privat di luar server, di dua tempat aman. Tanpa kunci ini cadangan tidak dapat dibuka.
2. Buat bucket Spaces khusus cadangan dan kunci akses yang dibatasi untuk bucket itu.
3. Di server, buat `/opt/nscas/backup.env` dengan izin 600, berisi `BACKUP_AGE_RECIPIENT` (kunci publik), `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, dan `BACKUP_S3_SECRET_KEY`.
4. Aktifkan jadwal: `sudo systemctl enable --now nscas-backup.timer`. Cadangan berjalan setiap hari pukul 01.30 WIB, dienkripsi sebelum menyentuh disk, dan disimpan 30 hari.
5. Uji pemulihan setiap bulan dari laptop administrator: `AGE_IDENTITY_FILE=nscas-backup.key backup.sh restore-test latest`. Cadangan yang belum pernah diuji pemulihannya belum dapat disebut cadangan.

## 9. Surel keluar

DigitalOcean menutup port SMTP dari Droplet secara bawaan. Undangan survei dan pengaturan ulang kata sandi memerlukan penyedia surel yang menerima sambungan pada port lain, atau permintaan pembukaan port kepada DigitalOcean. Dua hal yang perlu diperhatikan:

1. Penyedia surel menerima alamat surel responden, sehingga lokasinya termasuk lokasi pemrosesan data pribadi dan harus tercantum pada perjanjian pemrosesan data.
2. Domain pengirim perlu rekaman SPF dan DKIM agar undangan tidak masuk ke folder sampah.

Pilihan penyedia surel belum diputuskan dan menjadi keputusan pemilik proyek sebelum fase R2.

## 10. Pemantauan

1. Aktifkan pemantauan Droplet dan buat peringatan untuk pemakaian prosesor di atas 80 persen, memori di atas 85 persen, dan disk di atas 80 persen.
2. Buat pemeriksaan ketersediaan (uptime check) ke `https://nscas.nusasafety.co.id/up` dengan pemberitahuan ke surel administrator.
3. Periksa halaman Status sistem di aplikasi setelah setiap penempatan.
4. Server memulai ulang sendiri pukul 03.00 WIB bila pembaruan keamanan memerlukannya. Selama jendela survei besar, matikan mulai ulang otomatis sesuai catatan di `cloud-init.yaml`, lalu mulai ulang secara terjadwal.

## 11. Keputusan teknis yang perlu diketahui

| Keputusan | Alasan | Konsekuensi |
|---|---|---|
| Server web FrankenPHP di dalam image aplikasi | Satu kontainer melayani HTTP dan menerbitkan sertifikat TLS otomatis | Tidak perlu Nginx atau Certbot terpisah |
| Kontainer berjalan sebagai pengguna biasa, tanpa hak tambahan | Membatasi dampak bila aplikasi dibobol | Port di dalam kontainer 8080 dan 8443, dipetakan ke 80 dan 443 |
| PostgreSQL pada tata letak A tidak membuka port ke luar | Basis data tidak dapat dijangkau dari internet | Akses basis data hanya lewat server |
| Rahasia hanya di `/opt/nscas/.env` dengan izin 600 | Tidak ada rahasia di image atau repositori | Berkas ini harus ikut dicadangkan secara aman oleh administrator |
| Cadangan dienkripsi dengan kunci publik | Server tidak dapat membuka cadangannya sendiri | Kunci privat wajib disimpan di luar server |
| Pengguna `deploy` dapat memakai sudo tanpa kata sandi | Login hanya dengan kunci SSH; memudahkan pemeliharaan | Kunci SSH administrator harus dijaga seperti kata sandi utama |
| Akun pengelola pertama dibuat dengan perintah, bukan dari berkas | Tidak ada kata sandi awal yang tersimpan di mana pun | Kata sandi tampil satu kali di terminal |

## 12. Daftar periksa sebelum dipakai klien

| No. | Butir | Cara memeriksa |
|---|---|---|
| 1 | Syarat lokasi data pada `docs/04` bagian 1.1 terpenuhi | Dokumen persetujuan klien tersimpan |
| 2 | Alamat memakai HTTPS dan sertifikat sah | Buka alamat di peramban |
| 3 | `APP_DEBUG=false` dan `NSCAS_ENFORCE_TWO_FACTOR=true` | Baca `/opt/nscas/.env` |
| 4 | Login kata sandi dan login root lewat SSH tertolak | `ssh root@<alamat IP>` gagal |
| 5 | Hanya port 22, 80, 443 yang terbuka | `sudo ufw status` |
| 6 | Pengelola sistem sudah mengganti kata sandi dan mengaktifkan verifikasi dua langkah | Masuk ke aplikasi |
| 7 | Halaman Status sistem menunjukkan semua komponen berfungsi | Buka halaman Status sistem |
| 8 | Cadangan berjalan dan satu uji pemulihan berhasil | `systemctl list-timers nscas-backup.timer` dan hasil `restore-test` |
| 9 | Peringatan pemantauan dan pemeriksaan ketersediaan aktif | Panel DigitalOcean |
| 10 | Surel uji terkirim dan tidak masuk folder sampah | Kirim pengaturan ulang kata sandi ke alamat sendiri |
| 11 | Uji beban fase R12 lulus pada ukuran server yang dipakai | Laporan uji |
| 12 | `deploy.sh rollback` pernah dicoba di server uji | Catatan administrator |
