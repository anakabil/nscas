#!/usr/bin/env bash
# Membuka port aplikasi (3000) dan berkas (9100) untuk umum (postAttachCommand, docs/09), agar alamat uji coba
# dapat dibuka klien tanpa akun GitHub dan peramban dapat mengunggah bukti langsung ke penyimpanan.
# Port lain tetap privat. Bila gagal, ubah manual: tab Ports, klik kanan port, Port Visibility, Public.
set -uo pipefail
source "$(dirname "$0")/common.sh"

[ -n "${CODESPACE_NAME:-}" ] || exit 0

opened=""
for _ in $(seq 1 12); do
  if gh codespace ports visibility 3000:public 9100:public -c "$CODESPACE_NAME" >/dev/null 2>&1; then
    opened=yes
    break
  fi
  sleep 5
done

if [ -n "$opened" ]; then
  echo "Port 3000 (NSCAS) dan 9100 (berkas) terbuka untuk umum."
else
  echo "Port belum dapat dibuka otomatis. Buka tab Ports, klik kanan port 3000 dan 9100, pilih Port Visibility, Public."
fi

if [ -f "$ACCOUNT_FILE" ]; then
  echo "Alamat dan akun uji coba: .codespace/akun-uji-coba.txt"
else
  echo "Penyiapan awal masih berjalan (sekitar 15 menit). Kemajuannya: .codespace/logs/setup.log"
fi
