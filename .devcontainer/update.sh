#!/usr/bin/env bash
# Memperbarui codespace uji coba NSCAS ke versi terbaru di GitHub (docs/09 bagian 5). Dijalankan manual dari terminal
# codespace: bash .devcontainer/update.sh
#
# Langkah: ambil kode terbaru, pasang dependensi, migrasi basis data, build aset, lalu nyalakan ulang aplikasi. Data
# yang sudah dibuat di codespace tetap ada. Pilihan --demo juga menjalankan ulang data contoh dengan kata sandi yang
# sama; perintah itu mengembalikan status asesmen contoh ke nilai awalnya.
set -euo pipefail
source "$(dirname "$0")/common.sh"
exec > >(tee -a "$LOG_DIR/update.log") 2>&1

if [ ! -f .env ]; then
  echo "Penyiapan awal belum pernah selesai. Jalankan bash .devcontainer/setup.sh lebih dulu."
  exit 1
fi

step "Kode terbaru"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Ada perubahan berkas di codespace ini yang belum dikomit. Pembaruan dihentikan agar perubahan itu tidak hilang."
  git status --short --untracked-files=no
  exit 1
fi
git pull --ff-only

step "Dependensi PHP dan npm"
composer install --no-interaction --prefer-dist --no-progress
npm ci --no-audit --no-fund

step "Basis data"
wait_for_db
php artisan migrate --force --no-interaction

if [ "${1:-}" = "--demo" ]; then
  step "Data contoh"
  password=$(sed -n 's/^Kata sandi semua akun contoh: //p' "$ACCOUNT_FILE" 2>/dev/null || true)
  if [ -n "$password" ]; then
    php artisan nscas:demo --password="$password" --no-interaction >/dev/null
    unset password
    echo "Data contoh dijalankan ulang dengan kata sandi yang sama."
  else
    echo "Berkas akun tidak ditemukan; data contoh tidak diubah."
  fi
fi

step "Build aset"
npm run build

bash .devcontainer/start.sh --restart
step "Pembaruan selesai. Versi aktif: $(git log -1 --format='%h %s')"
