#!/usr/bin/env bash
# Penyiapan lingkungan uji coba NSCAS di GitHub Codespaces, sekali saat codespace dibuat (postCreateCommand,
# docs/09). Hanya untuk data demo fiktif: server Codespaces berada di luar Indonesia (CLAUDE.md aturan 7).
#
# Langkah: dependensi, Chromium untuk PDF, .env dengan rahasia acak, layanan pendukung, migrasi, seed, data demo,
# build produksi, lalu menyalakan aplikasi dan worker (start.sh). Alamat dan akun ditulis ke
# .codespace/akun-uji-coba.txt, yang tidak pernah dikomit.
set -euo pipefail
source "$(dirname "$0")/common.sh"
exec > >(tee -a "$LOG_DIR/setup.log") 2>&1

random_base64() { node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"; }
random_hex() { node -e "process.stdout.write(require('node:crypto').randomBytes($1).toString('hex'))"; }
# Kata sandi alfanumerik 20 karakter agar mudah diketik saat demo dan aman di berkas .env.
random_password() {
  node -e "const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';const b=require('node:crypto').randomBytes(20);process.stdout.write(Array.from(b,(x)=>c[x%c.length]).join(''))"
}

write_env() {
  local pg_password minio_user minio_password admin_password demo_password
  pg_password=$(random_hex 16)
  minio_user=nscas$(random_hex 4)
  minio_password=$(random_hex 20)
  admin_password=$(random_password)
  demo_password=$(random_password)

  (
    umask 077
    cat >.env <<EOF
# Dibuat oleh .devcontainer/setup.sh untuk uji coba di GitHub Codespaces (docs/09). Tidak dikomit.
# Hanya data demo fiktif; jangan memasukkan data pekerja sungguhan.

# Layanan pendukung (dibaca docker compose)
POSTGRES_PASSWORD=$pg_password
MINIO_ROOT_USER=$minio_user
MINIO_ROOT_PASSWORD=$minio_password
S3_BUCKET=nscas-dev
STORAGE_PUBLIC_HOST=$STORAGE_HOST

# Aplikasi
DATABASE_URL=postgresql://nscas:$pg_password@localhost:5432/nscas
AUTH_SECRET=$(random_base64)
AUTH_URL=$APP_URL_PUBLIC
APP_URL=$APP_URL_PUBLIC
SERVER_ACTIONS_ALLOWED_ORIGINS=$SERVER_ACTION_ORIGINS
DATA_ENCRYPTION_KEY=$(random_base64)
APP_TIMEZONE=Asia/Jakarta
# Peserta demo mengisi survei dari jaringan yang sama; batas bawaan 60 per menit terlalu ketat.
SURVEY_RATE_LIMIT_PER_MINUTE=600

S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_ENDPOINT=$PUBLIC_SCHEME://$STORAGE_HOST
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=$minio_user
S3_SECRET_ACCESS_KEY=$minio_password

# Surel uji ditampung Mailpit (port 8025), tidak terkirim ke luar.
SMTP_HOST=localhost
SMTP_PORT=1025
MAIL_FROM="NSCAS Uji Coba <noreply@nusasafety.co.id>"

SEED_ADMIN_EMAIL=admin@nusasafety.co.id
SEED_ADMIN_PASSWORD=$admin_password
SEED_ADMIN_NAME="Administrator NSCAS"
DEMO_PASSWORD=$demo_password
EOF

    cat >"$ACCOUNT_FILE" <<EOF
NSCAS, lingkungan uji coba GitHub Codespaces
Hanya berisi data demo fiktif. Jangan memasukkan data pekerja sungguhan.

Alamat aplikasi  : $APP_URL_PUBLIC/login
Kotak surat uji  : tab Ports, baris "Kotak surat uji (Mailpit)", port 8025

Administrator (SUPER_ADMIN)
  Surel      : admin@nusasafety.co.id
  Kata sandi : $admin_password

Akun demo, semuanya memakai kata sandi: $demo_password
  asesor.utama@demo.nusasafety.test         Lead assessor (Nusa Safety)
  asesor@demo.nusasafety.test               Asesor (Nusa Safety)
  admin.k3@contoh-konstruksi.test           Admin K3 klien (PT Contoh Konstruksi)
  koordinator.proyek@contoh-konstruksi.test Koordinator proyek
  direksi@contoh-konstruksi.test            Direksi (hanya melihat)

Saat masuk pertama, setiap akun diminta mengaktifkan verifikasi dua langkah. Siapkan aplikasi autentikator
di telepon, misalnya Google Authenticator atau Microsoft Authenticator, lalu pindai kode QR yang tampil.
EOF
  )
}

step "Dependensi npm"
npm ci --no-audit --no-fund

step "Chromium untuk PDF laporan"
npx playwright-core install --with-deps --only-shell chromium

step "Variabel lingkungan"
if [ -f .env ]; then
  echo ".env sudah ada; tidak diubah."
else
  write_env
  echo ".env dan $ACCOUNT_FILE dibuat dengan rahasia acak."
fi

step "Layanan pendukung"
wait_for_docker
"${COMPOSE[@]}" up -d --wait postgres minio mailpit storage-proxy
"${COMPOSE[@]}" run --rm minio-init

step "Migrasi dan seed"
npx prisma migrate deploy
npx prisma db seed

if [ -f "$STATE_DIR/demo-selesai" ]; then
  echo "Data demo sudah ada; dilewati."
else
  step "Data demo PT Contoh Konstruksi (beberapa menit)"
  # Unggahan bukti contoh dikirim langsung ke MinIO di dalam codespace, bukan lewat alamat publik yang belum
  # tentu terbuka saat penyiapan.
  S3_PUBLIC_ENDPOINT= npm run demo
  touch "$STATE_DIR/demo-selesai"
fi

step "Build produksi"
npm run build

bash .devcontainer/start.sh
step "Penyiapan selesai. Alamat dan akun: .codespace/akun-uji-coba.txt"
