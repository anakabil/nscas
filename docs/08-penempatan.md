# 08. Panduan Penempatan Produksi

Panduan ini menjelaskan langkah menempatkan NSCAS di satu VPS Ubuntu 24.04 LTS yang berlokasi di pusat data Indonesia, sesuai docs/02 bagian 7. Semua perintah dijalankan oleh administrator di server produksi. Berkas yang dipakai sudah tersedia di repositori:

| Berkas | Fungsi |
|---|---|
| `Dockerfile` | Image bertahap untuk aplikasi dan worker (image sama, perintah berbeda), termasuk Chromium headless untuk PDF |
| `docker-compose.prod.yml` | Aplikasi (3 replika), worker, PostgreSQL bervolume persisten, MinIO, Caddy, serta layanan sekali jalan `migrate`, `minio-init`, dan `backup` |
| `Caddyfile` | TLS otomatis untuk `nscas.nusasafety.co.id` dan domain berkas, HTTP/3, header keamanan, penyeimbang beban, tanpa log rute bertoken |
| `.env.production.example` | Templat seluruh variabel lingkungan produksi |
| `ops/minio/minio-init.sh` | Bucket privat dan akses khusus aplikasi |
| `ops/backup/` | Image cadangan, `backup.sh` (pg_dump terenkripsi age ke penyimpanan objek kedua, simpan 30 hari), `restore-test.sh` dan `checks.sql` (uji pemulihan) |
| `ops/systemd/` | Timer cadangan harian pukul 01.30 WIB |
| `ops/maintenance/shuffle-survey-rows.sql` | Pengacakan urutan fisik baris jawaban survei setelah survei ditutup (docs/06 R1) |

Penulisan `<...>` berarti nilai yang harus diganti. Contoh perintah memakai pengguna `nscas` dan direktori `/opt/nscas`.

## 1. Prasyarat

1. VPS di pusat data Indonesia, misalnya Biznet Gio, IDCloudHost, AWS wilayah Jakarta (`ap-southeast-3`), atau Google Cloud wilayah Jakarta (`asia-southeast2`). Lokasi ini wajib sesuai komitmen proposal (CLAUDE.md aturan 7). Spesifikasi minimum adalah 4 vCPU, 8 GB RAM, dan SSD 160 GB, karena uji beban docs/07 memakai sekitar 300 MB per replika aplikasi. Pilih paket dengan enkripsi disk di tingkat penyedia (docs/04 bagian 4). Bila penyedia tidak menyediakannya, pasang disk data terpisah terenkripsi LUKS untuk `/var/lib/docker`, dengan konsekuensi kata sandi pembuka harus dimasukkan setiap kali server dinyalakan ulang.
2. Penyimpanan objek kedua untuk cadangan. Gunakan penyedia atau wilayah yang berbeda dari VPS, tetap di Indonesia, kompatibel S3, dengan enkripsi sisi server aktif. Siapkan satu bucket (misalnya `nscas-backup`), kunci akses yang hanya berlaku untuk bucket itu, dan aturan siklus hidup yang menghapus objek setelah 35 hari sebagai pengaman kedua.
3. Layanan SMTP berlokasi di Indonesia untuk undangan dan pengingat.
4. Akses DNS domain `nusasafety.co.id` (saat ini dikelola di Hostinger).
5. Pengelola kata sandi perusahaan untuk menyimpan rahasia dan kunci privat cadangan.

## 2. DNS

Buat dua rekaman A (dan AAAA bila VPS memiliki IPv6) yang menunjuk ke alamat IP publik VPS:

| Nama | Jenis | Nilai |
|---|---|---|
| `nscas` | A | `<IP VPS>` |
| `berkas.nscas` | A | `<IP VPS>` |

Periksa dari laptop sebelum melanjutkan, karena Caddy memerlukan DNS yang benar untuk menerbitkan sertifikat:

```bash
dig +short nscas.nusasafety.co.id
dig +short berkas.nscas.nusasafety.co.id
```

## 3. Login pertama dan pengguna non-root

Masuk sebagai root atau pengguna bawaan penyedia, lalu perbarui sistem dan buat pengguna `nscas`:

```bash
apt update && apt full-upgrade -y
timedatectl set-timezone Asia/Jakarta
adduser nscas
usermod -aG sudo nscas
install -d -m 700 -o nscas -g nscas /home/nscas/.ssh
cp /root/.ssh/authorized_keys /home/nscas/.ssh/authorized_keys
chown nscas:nscas /home/nscas/.ssh/authorized_keys && chmod 600 /home/nscas/.ssh/authorized_keys
```

Dari laptop, pastikan dapat masuk sebagai `nscas` dengan kunci SSH sebelum menutup sesi root:

```bash
ssh nscas@<IP VPS>
```

Matikan login root dan login dengan kata sandi:

```bash
sudo tee /etc/ssh/sshd_config.d/10-nscas.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowUsers nscas
EOF
sudo sshd -t && sudo systemctl reload ssh
```

## 4. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status verbose
```

Port yang dibuka Docker melewati aturan masukan ufw. Karena itu, hanya layanan `caddy` yang boleh memiliki `ports` di `docker-compose.prod.yml`. Jangan pernah menambahkan `ports` untuk `postgres` atau `minio`. Bila konsol MinIO atau basis data perlu diakses, gunakan terowongan SSH, misalnya `ssh -L 5433:<IP kontainer postgres>:5432 nscas@<IP VPS>`.

Pasang juga fail2ban; jail SSH aktif secara bawaan di Ubuntu:

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

## 5. Pembaruan keamanan otomatis

```bash
sudo apt install -y unattended-upgrades apt-listchanges
sudo dpkg-reconfigure -plow unattended-upgrades
sudo tee /etc/apt/apt.conf.d/52nscas-unattended > /dev/null <<'EOF'
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
EOF
sudo unattended-upgrade --dry-run --debug | tail -5
```

Mulai ulang otomatis pukul 03.00 WIB berada di luar jam kerja dan setelah cadangan harian pukul 01.30 WIB. Selama jendela survei besar, pertimbangkan menunda mulai ulang dengan `Automatic-Reboot "false"` lalu memulai ulang secara terjadwal.

## 6. Docker Engine

Pasang dari repositori resmi Docker:

```bash
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{ "live-restore": true, "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
EOF
sudo systemctl restart docker
sudo usermod -aG docker nscas
```

Keluar lalu masuk kembali agar keanggotaan grup `docker` berlaku. Keanggotaan grup ini setara dengan akses root, jadi hanya berikan kepada administrator.

## 7. Kode aplikasi

Gunakan deploy key GitHub yang hanya bisa membaca, lalu ambil versi rilis yang sudah lulus seluruh tes:

```bash
sudo install -d -o nscas -g nscas /opt/nscas
git clone git@github.com:anakabil/nscas.git /opt/nscas
cd /opt/nscas
git checkout <tag rilis>
```

## 8. Rahasia dan variabel lingkungan

```bash
cd /opt/nscas
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # DATA_ENCRYPTION_KEY
openssl rand -hex 24      # POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, S3_SECRET_ACCESS_KEY, SEED_ADMIN_PASSWORD
openssl rand -hex 10      # MINIO_ROOT_USER, S3_ACCESS_KEY_ID
nano .env.production
```

Isi seluruh variabel sesuai komentar di templat.

- `DOMAIN` diisi `nscas.nusasafety.co.id` dan `STORAGE_DOMAIN` diisi `berkas.nscas.nusasafety.co.id`.
- `MONITORING_IPS` diisi alamat layanan pemantau.
- Nilai SMTP diisi sesuai penyedia surel di Indonesia.

Simpan salinan `DATA_ENCRYPTION_KEY` dan `AUTH_SECRET` di pengelola kata sandi perusahaan. Bila `DATA_ENCRYPTION_KEY` hilang, kontak responden terenkripsi dan rahasia verifikasi dua langkah tidak dapat dibuka, bahkan dari cadangan.

## 9. Membangun image dan menyiapkan basis data

```bash
cd /opt/nscas
export COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE --profile tools build
$COMPOSE up -d postgres minio
$COMPOSE run --rm minio-init
$COMPOSE run --rm migrate
$COMPOSE run --rm migrate prisma db seed
```

Seed membuat pengguna SUPER_ADMIN pertama, instrumen NS-SCML-1.0, dan organisasi demo kosong. Setelah seed selesai, hapus nilai `SEED_ADMIN_PASSWORD` dari `.env.production`.

Jangan menjalankan `npm run demo` di produksi. Skrip demo memang tidak dimasukkan ke image.

## 10. Menjalankan aplikasi

```bash
$COMPOSE up -d
$COMPOSE ps
$COMPOSE logs --tail 50 app worker caddy
```

Status yang diharapkan: tiga replika `app` sehat, `worker` mencetak "Worker NSCAS berjalan.", dan `caddy` sudah memperoleh sertifikat untuk kedua domain.

## 11. Pemeriksaan setelah penempatan

```bash
curl -sI https://nscas.nusasafety.co.id/login | grep -iE "^HTTP|strict-transport|content-security|x-frame|x-content"
curl -sI https://nscas.nusasafety.co.id/s/contoh | grep -i referrer-policy      # harus no-referrer
curl -s -o /dev/null -w "%{http_code}\n" https://nscas.nusasafety.co.id/health  # 404 dari luar alamat pemantau
curl -s -o /dev/null -w "%{http_code}\n" http://nscas.nusasafety.co.id/login    # 308 ke HTTPS
$COMPOSE exec caddy sh -c 'grep -c "\"uri\":\"/s/" /data/logs/access.log'      # harus 0
```

Lanjutkan dengan pemeriksaan berikut:

1. Uji TLS di SSL Labs untuk kedua domain. Sasarannya peringkat A dengan TLS 1.2 ke atas (docs/04 bagian 4).
2. Masuk sebagai SUPER_ADMIN dan segera aktifkan verifikasi dua langkah. Simpan kode cadangannya di pengelola kata sandi.
3. Buat akun lead assessor dan asesor, lalu buat organisasi klien PT Adhi Karya (Persero) Tbk.
4. Lakukan uji asap: unggah satu bukti PDF (memastikan URL bertanda tangan ke `berkas.nscas.nusasafety.co.id` dan CORS bekerja), susun satu versi laporan pada asesmen uji (memastikan Chromium di worker merender PDF), dan kirim satu undangan uji ke surel internal.
5. Jalankan uji beban k6 dari mesin terpisah sebelum survei pertama klien dibuka. Ikuti docs/07 bagian 8 dengan `BASE_URL=https://nscas.nusasafety.co.id` pada asesmen uji.

## 12. Cadangan harian dan uji pemulihan

### 12.1 Kunci enkripsi

Buat pasangan kunci age di laptop administrator, bukan di server:

```bash
age-keygen -o nscas-backup.key
grep "public key" nscas-backup.key
```

Simpan `nscas-backup.key` di pengelola kata sandi perusahaan dan satu salinan luring, dengan akses dua orang. Isi `BACKUP_AGE_RECIPIENT` di `.env.production` dengan kunci publik (diawali `age1`), lalu isi juga variabel `BACKUP_S3_*`. Server hanya memegang kunci publik, sehingga pihak yang menguasai server tidak dapat membuka cadangan.

### 12.2 Timer harian

```bash
sudo cp /opt/nscas/ops/systemd/nscas-backup.service /opt/nscas/ops/systemd/nscas-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nscas-backup.timer
sudo systemctl start nscas-backup.service
journalctl -u nscas-backup.service -n 30 --no-pager
systemctl list-timers nscas-backup.timer
```

Setiap malam skrip mengalirkan `pg_dump` langsung ke `age` lalu ke bucket cadangan dengan nama `db/<tahun>/<bulan>/nscas-<waktu>.dump.age`. Cadangan yang lebih tua dari 30 hari dihapus. Berkas bukti dan rekaman disalin ke `objects/` dengan mode mirror, sehingga berkas yang dimusnahkan (docs/04 bagian 7) ikut terhapus di salinan. Data mentah yang dimusnahkan masih ada di cadangan basis data paling lama 30 hari, lalu hilang bersama habisnya masa simpan cadangan. Catat hal ini di berita acara pemusnahan bila klien menanyakannya.

### 12.3 Uji pemulihan bulanan

Jalankan setiap bulan di laptop administrator yang memegang kunci privat, bukan di server produksi:

```bash
cd nscas
docker build -t nscas-backup ops/backup
chmod 644 nscas-backup.key   # dibaca pengguna postgres di dalam kontainer; hapus salinan ini setelah uji
docker run --rm \
  -e BACKUP_S3_ENDPOINT=<endpoint> -e BACKUP_S3_ACCESS_KEY_ID=<kunci baca> -e BACKUP_S3_SECRET_ACCESS_KEY=<rahasia> \
  -e BACKUP_S3_BUCKET=nscas-backup -e AGE_IDENTITY=/run/nscas-backup.key \
  -v "$PWD/nscas-backup.key:/run/nscas-backup.key:ro" \
  --entrypoint nscas-restore-test nscas-backup
```

Skrip mengunduh cadangan terbaru, membuka enkripsinya, dan memulihkannya ke PostgreSQL sementara. Setelah itu `ops/backup/checks.sql` memeriksa migrasi, pemicu hanya-tambah, jumlah baris utama, dan waktu catatan audit terakhir. Hasil yang diharapkan diakhiri baris "LULUS". Catat hasilnya:

| Tanggal | Cadangan yang diuji | Migrasi | Audit terakhir | Hasil | Pelaksana |
|---|---|---|---|---|---|
| | | | | | |

## 13. Pemeliharaan rutin

| Kapan | Tindakan | Perintah atau rujukan |
|---|---|---|
| Setelah setiap jendela survei ditutup | Acak urutan fisik baris jawaban survei (docs/06 R1) | `$COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' < ops/maintenance/shuffle-survey-rows.sql` |
| Harian, otomatis | Cadangan | Timer `nscas-backup.timer` |
| Mingguan, otomatis | Penandaan masa simpan data mentah | Worker, `retention.scan` Senin 06.00 WIB |
| Mingguan | Periksa log, ruang disk, dan status layanan | `$COMPOSE ps`, `df -h`, `docker system df` |
| Bulanan | Uji pemulihan | Langkah 12.3 |
| Bulanan | Perbarui image dasar PostgreSQL, MinIO, Caddy, dan Node.js | `$COMPOSE pull` lalu langkah 14 |
| Sesuai kebutuhan | Pemusnahan data mentah setelah konfirmasi klien | Halaman Retensi data (SUPER_ADMIN), docs/04 bagian 7 |

Pantau `https://nscas.nusasafety.co.id/health` dari alamat di `MONITORING_IPS` setiap menit, dengan peringatan ke tim bila status bukan 200. Sertifikat TLS diperbarui otomatis oleh Caddy.

## 14. Memperbarui versi dan rollback

Lakukan pembaruan di luar jendela survei aktif.

```bash
cd /opt/nscas
sudo systemctl start nscas-backup.service      # cadangan tepat sebelum migrasi
git fetch --tags && git checkout <tag baru>
sed -i "s/^NSCAS_VERSION=.*/NSCAS_VERSION=<tag baru>/" .env.production
$COMPOSE --profile tools build
$COMPOSE run --rm migrate
$COMPOSE up -d
$COMPOSE ps
```

Migrasi basis data hanya bergerak maju. Rollback kode dilakukan dengan `git checkout <tag sebelumnya>`, mengembalikan `NSCAS_VERSION`, lalu `$COMPOSE up -d`, selama migrasi versi baru tidak mengubah struktur yang dipakai versi lama. Bila struktur berubah, pulihkan cadangan yang dibuat tepat sebelum migrasi ke basis data baru. Lakukan ini hanya setelah memastikan tidak ada data baru yang hilang, dan catat kejadiannya.

Untuk menambah replika aplikasi selama survei besar, ubah `APP_REPLICAS` lalu jalankan `$COMPOSE up -d app`. Pastikan nilai replika dikali `DATABASE_POOL_MAX`, ditambah worker, tetap di bawah `max_connections` 150.

## 15. Daftar periksa sebelum survei pertama klien

Butir operasional docs/06 yang harus diperiksa di server:

| Butir docs/06 | Pemeriksaan | Selesai |
|---|---|---|
| 1.2 Lokasi data | VPS, penyimpanan cadangan, dan SMTP berada di Indonesia; bukti lokasi dari penyedia diarsipkan | |
| 4.1 TLS dan HSTS | Langkah 11, SSL Labs peringkat A | |
| 4.3 Enkripsi disk | Konfirmasi tertulis penyedia atau LUKS | |
| 4.4 Cadangan terenkripsi | Langkah 12, satu uji pemulihan LULUS | |
| R1 Urutan baris | Prosedur langkah 13 dipahami tim | |
| R3 dan R4 Batas laju | `SURVEY_RATE_LIMIT_PER_MINUTE=600` dengan 3 replika | |
| R5 Log rute bertoken | Pemeriksaan log langkah 11 menghasilkan 0 | |
| R7 `/health` | 404 dari luar alamat pemantau | |
| R8 CORS dan enkripsi penyimpanan | Unggah bukti dari peramban berhasil; enkripsi sisi server aktif di bucket cadangan | |
| R9 Telemetri | `NEXT_TELEMETRY_DISABLED=1` sudah ada di image | |
| Rahasia | `.env.production` ber-mode 600; `DATA_ENCRYPTION_KEY`, `AUTH_SECRET`, dan kunci age tersimpan di pengelola kata sandi | |
| Akun | SUPER_ADMIN, lead assessor, dan asesor sudah mengaktifkan verifikasi dua langkah | |
| Uji beban | k6 dari mesin terpisah memenuhi sasaran docs/07 | |

## 16. Catatan verifikasi saat penyusunan (Fase 16)

Berkas penempatan diuji di lingkungan pengembangan, bukan di server produksi:

- `next build` dan pemasangan dependensi produksi berjalan di dalam Docker.
- Tumpukan `docker-compose.prod.yml` dijalankan lengkap dengan dua replika aplikasi di belakang Caddy (domain `localhost`, sertifikat internal Caddy). Yang terbukti bekerja:
  - migrasi, seed, dan inisialisasi MinIO;
  - masuk SUPER_ADMIN beserta pendaftaran verifikasi dua langkah;
  - header keamanan, `Referrer-Policy: no-referrer` pada rute survei, dan pengalihan HTTP ke HTTPS;
  - `/health` dijawab 404 dari luar;
  - tidak ada log akses untuk `/s/*`;
  - worker berjalan.
- Skrip cadangan dan uji pemulihan dijalankan nyata terhadap basis data demo dan MinIO pengembangan: cadangan terenkripsi age terunggah, mirror berkas berhasil, dan uji pemulihan LULUS.
- `ops/maintenance/shuffle-survey-rows.sql` diuji pada basis data demo.
- `Caddyfile` lolos `caddy validate` dan `caddy fmt`.

Yang belum dapat diverifikasi karena kebijakan jaringan lingkungan pengembangan memblokir repositori paket Debian dan Alpine:

1. Lapisan Chromium di `Dockerfile` (`playwright-core install --with-deps`). PDF laporan di image produksi belum diuji.
2. Build `ops/backup/Dockerfile` (`apk add age minio-client`).
3. Penerbitan sertifikat Let's Encrypt dan pengiriman SMTP nyata.

Ketiganya terperiksa pada langkah 9 sampai 12 di server.
