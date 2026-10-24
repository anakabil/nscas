#!/bin/bash
# Skrip pasca-pemasangan VPS Hostinger untuk NSCAS (docs/08 bagian 17). Isinya diunggah ke Hostinger sebagai
# post-install script setelah __NSCAS_REF__ dan __ADMIN_EMAIL__ diganti; Hostinger menjalankannya sekali sebagai
# root setelah sistem operasi terpasang. Tidak memuat rahasia: semuanya dibuat di server oleh bootstrap.sh.
set -euo pipefail
export HOME=${HOME:-/root}

NSCAS_REF="__NSCAS_REF__"
export NSCAS_ADMIN_EMAIL="__ADMIN_EMAIL__"
REPO_URL=https://github.com/anakabil/nscas.git
APP_DIR=/opt/nscas

install -d -m 755 /var/log/nscas
exec > >(tee -a /var/log/nscas/bootstrap.log) 2>&1
echo "$(date '+%F %T') == Pasca-pemasangan NSCAS dimulai (ref $NSCAS_REF)" | tee -a /var/log/nscas/langkah.log

# Jaringan kadang belum siap tepat setelah pemasangan.
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null --max-time 10 https://github.com && break
  sleep 10
done

command -v git >/dev/null || { apt-get -o DPkg::Lock::Timeout=900 update && apt-get -o DPkg::Lock::Timeout=900 -y install git; }
git config --global --add safe.directory "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
git -C "$APP_DIR" fetch --quiet origin
git -C "$APP_DIR" checkout --quiet "$NSCAS_REF"

exec bash "$APP_DIR/ops/hostinger/bootstrap.sh"
