#!/usr/bin/env bash
# Pemasangan NSCAS di VPS Hostinger tanpa sesi SSH (docs/08 bagian 17). Dijalankan sebagai root oleh skrip
# pasca-pemasangan Hostinger (ops/hostinger/post-install.sh) setelah kode diunduh ke /opt/nscas.
#
# Langkahnya sama dengan docs/08 langkah 3 sampai 11: paket sistem, firewall, Docker, pengguna nscas, rahasia,
# build, migrasi, seed, lalu menjalankan aplikasi. Seluruh rahasia dibuat di server dengan openssl dan tidak
# pernah dicetak ke log. Aman dijalankan ulang: rahasia yang sudah ada dan seed yang sudah berjalan dilewati.
#
# Kemajuan ringkas ditulis ke /var/log/nscas/langkah.log agar dapat dibaca lewat Docker Manager Hostinger
# (proyek nscas-status) tanpa SSH; keluaran lengkap ada di /var/log/nscas/bootstrap.log.
set -Eeuo pipefail

: "${NSCAS_ADMIN_EMAIL:?NSCAS_ADMIN_EMAIL wajib diisi}"
NSCAS_DOMAIN=${NSCAS_DOMAIN:-nscas.nusasafety.co.id}
NSCAS_STORAGE_DOMAIN=${NSCAS_STORAGE_DOMAIN:-berkas.nscas.nusasafety.co.id}

APP_DIR=/opt/nscas
ENV_FILE=$APP_DIR/.env.production
LOG_DIR=/var/log/nscas
STEPS_LOG=$LOG_DIR/langkah.log
DETAIL_LOG=$LOG_DIR/bootstrap.log
STATE_DIR=/var/lib/nscas
ADMIN_FILE=/root/nscas-admin-awal.txt
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)
CURRENT_STEP=mulai

export DEBIAN_FRONTEND=noninteractive
APT=(apt-get -o DPkg::Lock::Timeout=900 -y)

install -d -m 755 "$LOG_DIR"
install -d -m 700 "$STATE_DIR"
touch "$STEPS_LOG"

note() { printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$STEPS_LOG"; }
step() { CURRENT_STEP=$1; note "== $1"; }

on_error() {
  local code=$?
  note "NSCAS_BOOTSTRAP_FAILED langkah=\"$CURRENT_STEP\" kode=$code"
  if [ -f "$DETAIL_LOG" ]; then
    { echo "---- 80 baris terakhir bootstrap.log ----"; tail -n 80 "$DETAIL_LOG"; echo "----"; } >>"$STEPS_LOG"
  fi
  exit "$code"
}
trap on_error ERR

# set_env KEY VALUE: mengganti baris KEY= di .env.production tanpa mencetak nilainya.
set_env() {
  NSCAS_KEY=$1 NSCAS_VALUE=$2 python3 - "$ENV_FILE" <<'PY'
import os
import sys

path = sys.argv[1]
key, value = os.environ["NSCAS_KEY"], os.environ["NSCAS_VALUE"]
with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines()
found = False
for index, line in enumerate(lines):
    if line.startswith(key + "="):
        lines[index] = f"{key}={value}"
        found = True
if not found:
    lines.append(f"{key}={value}")
with open(path, "w", encoding="utf-8") as handle:
    handle.write("\n".join(lines) + "\n")
PY
}

# Kata sandi alfanumerik agar aman di berkas .env (tanpa $, #, atau tanda kutip).
random_password() {
  local value=""
  while [ "${#value}" -lt 24 ]; do
    value=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-24)
  done
  printf '%s' "$value"
}

retry() {
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then return 0; fi
    note "Percobaan $attempt gagal: $*; diulang dalam 60 detik."
    sleep 60
  done
  "$@"
}

step "Paket sistem dan zona waktu"
"${APT[@]}" update
"${APT[@]}" install ca-certificates curl git openssl python3 ufw fail2ban unattended-upgrades apt-listchanges
timedatectl set-timezone Asia/Jakarta || ln -sf /usr/share/zoneinfo/Asia/Jakarta /etc/localtime

step "Pembaruan keamanan otomatis"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat >/etc/apt/apt.conf.d/52nscas-unattended <<'EOF'
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
EOF
systemctl enable --now fail2ban

step "Docker Engine"
if ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list
  "${APT[@]}" update
  "${APT[@]}" install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
if [ ! -f /etc/docker/daemon.json ]; then
  cat >/etc/docker/daemon.json <<'EOF'
{ "live-restore": true, "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
EOF
  systemctl restart docker
fi
systemctl enable --now docker
note "$(docker --version); $(docker compose version)"

step "Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

step "Pengguna nscas"
id nscas >/dev/null 2>&1 || useradd --create-home --shell /bin/bash nscas
usermod -aG docker nscas
chown -R nscas:nscas "$APP_DIR"
# Repositori dimiliki nscas, sedangkan skrip ini berjalan sebagai root.
git config --global --add safe.directory "$APP_DIR"
cd "$APP_DIR"
note "Versi kode: $(git rev-parse --short HEAD)"

step "Rahasia dan variabel lingkungan"
if [ -f "$ENV_FILE" ]; then
  note ".env.production sudah ada; rahasia tidak dibuat ulang."
else
  (umask 077 && cp .env.production.example "$ENV_FILE")
  set_env NSCAS_VERSION "$(git rev-parse --short HEAD)"
  set_env DOMAIN "$NSCAS_DOMAIN"
  set_env STORAGE_DOMAIN "$NSCAS_STORAGE_DOMAIN"
  set_env ACME_EMAIL "$NSCAS_ADMIN_EMAIL"
  set_env POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  set_env AUTH_SECRET "$(openssl rand -base64 32)"
  set_env DATA_ENCRYPTION_KEY "$(openssl rand -base64 32)"
  set_env MINIO_ROOT_USER "$(openssl rand -hex 10)"
  set_env MINIO_ROOT_PASSWORD "$(openssl rand -hex 20)"
  set_env S3_ACCESS_KEY_ID "$(openssl rand -hex 10)"
  set_env S3_SECRET_ACCESS_KEY "$(openssl rand -hex 20)"
  admin_password=$(random_password)
  set_env SEED_ADMIN_EMAIL "$NSCAS_ADMIN_EMAIL"
  set_env SEED_ADMIN_PASSWORD "$admin_password"
  (
    umask 077
    cat >"$ADMIN_FILE" <<EOF
NSCAS, akun SUPER_ADMIN pertama

Alamat masuk : https://$NSCAS_DOMAIN/login
Surel        : $NSCAS_ADMIN_EMAIL
Kata sandi   : $admin_password

Segera setelah masuk pertama kali:
1. Ganti kata sandi di menu Akun dan aktifkan verifikasi dua langkah.
2. Simpan salinan DATA_ENCRYPTION_KEY dan AUTH_SECRET di pengelola kata sandi perusahaan:
     grep -E '^(DATA_ENCRYPTION_KEY|AUTH_SECRET)=' $ENV_FILE
   Tanpa DATA_ENCRYPTION_KEY, kontak responden dan verifikasi dua langkah tidak dapat dipulihkan dari cadangan.
3. Hapus berkas ini:
     shred -u $ADMIN_FILE
EOF
  )
  unset admin_password
  chown nscas:nscas "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  note "Rahasia dibuat di server. Kata sandi admin awal tersimpan di $ADMIN_FILE (hanya root)."
fi

step "Mengunduh image pendukung"
retry "${COMPOSE[@]}" pull postgres minio minio-init caddy

step "Membangun image aplikasi"
if ! "${COMPOSE[@]}" build --progress=plain; then
  note "Build gagal; diulang dengan image dasar dari mirror.gcr.io."
  NODE_IMAGE=mirror.gcr.io/library/node:22.22.0-bookworm-slim "${COMPOSE[@]}" build --progress=plain
fi

step "Basis data dan penyimpanan objek"
"${COMPOSE[@]}" up -d --wait --wait-timeout 300 postgres minio
"${COMPOSE[@]}" run --rm minio-init

step "Migrasi basis data"
"${COMPOSE[@]}" run --rm migrate

if [ -f "$STATE_DIR/seeded" ]; then
  note "Seed sudah pernah dijalankan; dilewati."
else
  step "Seed instrumen dan SUPER_ADMIN"
  "${COMPOSE[@]}" run --rm migrate prisma db seed
  touch "$STATE_DIR/seeded"
  set_env SEED_ADMIN_PASSWORD ""
  note "Seed selesai; SEED_ADMIN_PASSWORD dikosongkan dari .env.production."
fi

step "Menjalankan aplikasi"
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}' | tee -a "$STEPS_LOG"

step "Unit cadangan harian (belum diaktifkan)"
install -m 644 ops/systemd/nscas-backup.service ops/systemd/nscas-backup.timer /etc/systemd/system/
systemctl daemon-reload
note "Aktifkan setelah BACKUP_* dan BACKUP_AGE_RECIPIENT diisi: systemctl enable --now nscas-backup.timer"

step "Menunggu sertifikat TLS dan halaman masuk"
# Caddy menerbitkan sertifikat setelah DNS kedua domain menunjuk ke VPS ini; tunggu paling lama 60 menit.
ready=""
for attempt in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$NSCAS_DOMAIN:443:127.0.0.1" "https://$NSCAS_DOMAIN/login" || true)
  if [ "$code" = "200" ]; then
    ready=yes
    break
  fi
  if [ $((attempt % 6)) -eq 1 ]; then note "Belum siap (kode HTTP $code); menunggu DNS dan sertifikat."; fi
  sleep 30
done
storage_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$NSCAS_STORAGE_DOMAIN:443:127.0.0.1" "https://$NSCAS_STORAGE_DOMAIN/" || true)
note "https://$NSCAS_STORAGE_DOMAIN/ menjawab kode HTTP $storage_code (000 berarti TLS belum siap)."

if [ -n "$ready" ]; then
  note "NSCAS_BOOTSTRAP_DONE https://$NSCAS_DOMAIN/login aktif dengan sertifikat yang sah."
else
  note "NSCAS_BOOTSTRAP_DONE_WITHOUT_TLS aplikasi berjalan, tetapi sertifikat belum terbit. Periksa DNS lalu: docker compose -f docker-compose.prod.yml --env-file .env.production logs caddy"
fi
