#!/usr/bin/env bash
# Penyiapan lingkungan uji coba NSCAS di GitHub Codespaces, sekali saat codespace dibuat (postCreateCommand, docs/09).
# Hanya untuk data contoh fiktif: jangan memasukkan data pekerja sungguhan (CLAUDE.md aturan 7).
#
# Langkah: dependensi PHP dan npm, .env dengan kunci acak, migrasi dan seed, data contoh dengan satu kata sandi acak
# untuk semua akun contoh, build aset, lalu menyalakan aplikasi (start.sh). Alamat dan akun ditulis ke
# .codespace/akun-uji-coba.txt, yang tidak pernah dikomit. Kata sandi tidak ditulis ke log.
set -euo pipefail
source "$(dirname "$0")/common.sh"
exec > >(tee -a "$LOG_DIR/setup.log") 2>&1

# Kata sandi alfanumerik 20 karakter, tanpa huruf yang mudah tertukar, agar mudah diketik.
random_password() {
  php -r '$c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; $p = ""; for ($i = 0; $i < 20; $i++) { $p .= $c[random_int(0, strlen($c) - 1)]; } echo $p;'
}

write_env() {
  local app_key secure=false
  app_key="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
  case "$APP_URL_PUBLIC" in https://*) secure=true ;; esac
  (
    umask 077
    cat >.env <<EOF
# Dibuat oleh .devcontainer/setup.sh untuk uji coba di GitHub Codespaces (docs/09). Tidak dikomit.
# Hanya data contoh fiktif. Jangan memasukkan data pekerja sungguhan.
APP_NAME=NSCAS
APP_ENV=staging
APP_KEY=$app_key
APP_DEBUG=false
APP_URL=$APP_URL_PUBLIC
APP_LOCALE=id
APP_FALLBACK_LOCALE=id
APP_FAKER_LOCALE=id_ID
APP_MAINTENANCE_DRIVER=file
PHP_CLI_SERVER_WORKERS=4
HASH_DRIVER=argon2id

LOG_CHANNEL=single
LOG_LEVEL=info

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=nscas
DB_USERNAME=nscas
DB_PASSWORD=nscas

SESSION_DRIVER=database
SESSION_LIFETIME=480
SESSION_ENCRYPT=true
SESSION_PATH=/
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=$secure

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=database

# Surel uji ditampung Mailpit (port 8025), tidak terkirim ke luar.
MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="admin@nusasafety.co.id"
MAIL_FROM_NAME="NSCAS Uji Coba"

VITE_APP_NAME=NSCAS

# Uji coba: verifikasi dua langkah tidak diwajibkan agar keenam akun contoh dapat langsung dicoba. Ubah menjadi true
# untuk mencoba alurnya (docs/09 bagian 4). Di produksi nilai ini wajib true.
NSCAS_ENFORCE_TWO_FACTOR=false
NSCAS_DATA_LOCATION=Singapura
# Codespace hanya dapat dijangkau lewat penerus port GitHub, sehingga pemanggil langsung dipercaya sebagai proksi.
TRUSTED_PROXIES=*
EOF
  )
}

write_accounts() {
  local password=$1
  (
    umask 077
    cat >"$ACCOUNT_FILE" <<EOF
NSCAS versi 2, lingkungan uji coba GitHub Codespaces
Hanya data contoh fiktif. Jangan memasukkan data pekerja sungguhan (docs/09).

Alamat aplikasi  : $APP_URL_PUBLIC/login
Kotak surat uji  : tab Ports, baris "Kotak surat uji (Mailpit)", port 8025

Kata sandi semua akun contoh: $password

Akun contoh
  pengelola@contoh.test       Pengelola sistem
  asesor.utama@contoh.test    Asesor utama, Nusa Safety
  asesor@contoh.test          Asesor, Nusa Safety
  admin.klien@contoh.test     Administrator klien, PT Konstruksi Contoh
  koordinator@contoh.test     Koordinator unit, PT Konstruksi Contoh
  eksekutif@contoh.test       Peninjau eksekutif, PT Konstruksi Contoh

Setiap akun menampilkan beranda dan menu yang berbeda sesuai perannya. Tahap 1 (perencanaan), seluruh halaman tahap 2
(responden, kode QR, partisipasi, penilaian mandiri, bukti dokumen, observasi lapangan), dan survei responden di telepon
sudah dapat dipakai, begitu pula seluruh modul tahap 3 sampai 6 (fase R6 sampai R12).
Undangan dan pengingat survei tidak terkirim ke luar; bukalah kotak surat uji (Mailpit) untuk melihatnya.
EOF
  )
}

step "Dependensi PHP"
composer install --no-interaction --prefer-dist --no-progress

step "Dependensi npm"
npm ci --no-audit --no-fund

step "Variabel lingkungan"
if [ -f .env ]; then
  echo ".env sudah ada; tidak diubah."
else
  write_env
  echo ".env dibuat dengan kunci aplikasi acak."
fi

step "Basis data"
wait_for_db
php artisan migrate --force --seed --no-interaction

step "Data contoh"
if [ -f "$ACCOUNT_FILE" ]; then
  echo "Akun contoh sudah dibuat sebelumnya; tidak diubah."
else
  password=$(random_password)
  # Keluaran perintah memuat kata sandi, sehingga tidak diteruskan ke log.
  php artisan nscas:demo --password="$password" --no-interaction >/dev/null
  write_accounts "$password"
  unset password
  echo "Akun contoh dibuat. Alamat dan kata sandi: .codespace/akun-uji-coba.txt"
fi

step "Build aset"
npm run build

bash .devcontainer/start.sh
step "Penyiapan selesai. Alamat dan akun: .codespace/akun-uji-coba.txt"
