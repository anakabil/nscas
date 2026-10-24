#!/usr/bin/env bash
# Menyalakan layanan pendukung, aplikasi (build produksi, next start), dan worker pg-boss di Codespaces
# (docs/09). Dijalankan setiap kali codespace menyala (postStartCommand) dan di akhir setup.sh.
# Log aplikasi dan worker ada di .codespace/logs.
set -euo pipefail
source "$(dirname "$0")/common.sh"

if [ ! -f .env ] || [ ! -f .next/BUILD_ID ]; then
  echo "Penyiapan awal belum selesai (lihat .codespace/logs/setup.log); aplikasi belum dijalankan."
  exit 0
fi

wait_for_docker
"${COMPOSE[@]}" up -d --wait postgres minio mailpit storage-proxy

# setsid melepas proses dari sesi perintah siklus hidup codespace agar tetap berjalan setelah skrip ini selesai.
if app_ready || pgrep -f "next-server|next start" >/dev/null; then
  echo "Aplikasi sudah berjalan."
else
  setsid nohup npm start >>"$LOG_DIR/app.log" 2>&1 </dev/null &
fi
if pgrep -f "src/worker.ts" >/dev/null; then
  echo "Worker sudah berjalan."
else
  setsid nohup npm run worker >>"$LOG_DIR/worker.log" 2>&1 </dev/null &
fi

for _ in $(seq 1 90); do
  if app_ready; then
    echo "NSCAS siap: $APP_URL_PUBLIC/login"
    exit 0
  fi
  sleep 2
done
echo "Aplikasi belum menjawab setelah 3 menit; periksa .codespace/logs/app.log"
