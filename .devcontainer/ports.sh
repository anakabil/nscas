#!/usr/bin/env bash
# Membuka port aplikasi (8000) untuk umum (postAttachCommand, docs/09), agar alamat uji coba dapat dibuka tim tanpa
# akun GitHub, termasuk dari telepon. Port kotak surat uji (8025) tetap privat. Bila gagal, ubah manual: tab Ports,
# klik kanan port 8000, Port Visibility, Public.
set -uo pipefail
source "$(dirname "$0")/common.sh"

[ -n "$CODESPACE_NAME" ] || exit 0

opened=""
if command -v gh >/dev/null; then
  for _ in $(seq 1 12); do
    if gh codespace ports visibility "$APP_PORT:public" -c "$CODESPACE_NAME" >/dev/null 2>&1; then
      opened=yes
      break
    fi
    sleep 5
  done
fi

if [ -n "$opened" ]; then
  echo "Port $APP_PORT (NSCAS) terbuka untuk umum."
else
  echo "Port belum dapat dibuka otomatis. Buka tab Ports, klik kanan port $APP_PORT, pilih Port Visibility, Public."
fi

if [ -f "$ACCOUNT_FILE" ]; then
  echo "Alamat dan akun uji coba: .codespace/akun-uji-coba.txt"
else
  echo "Penyiapan awal masih berjalan (sekitar 10 menit). Kemajuannya: .codespace/logs/setup.log"
fi
