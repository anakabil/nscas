#!/usr/bin/env bash
# Menyalakan aplikasi (php artisan serve), worker antrean, dan penjadwal di Codespaces (docs/09). Dijalankan setiap kali codespace
# menyala (postStartCommand) dan di akhir setup.sh. Aman dijalankan ulang kapan saja dari terminal.
# Pilihan --restart mematikan aplikasi dan worker lebih dulu, misalnya setelah .env diubah.
# Log aplikasi dan worker ada di .codespace/logs; galat aplikasi di storage/logs/laravel.log.
set -euo pipefail
source "$(dirname "$0")/common.sh"

if [ ! -f .env ] || [ ! -f public/build/manifest.json ]; then
  echo "Penyiapan awal belum selesai (lihat .codespace/logs/setup.log); aplikasi belum dijalankan."
  exit 0
fi

if [ "${1:-}" = "--restart" ]; then
  echo "Aplikasi dan worker dimatikan untuk dinyalakan ulang."
  stop_app
fi

if [ -n "$PUBLIC_HOST_KNOWN" ]; then
  if [ "$(sync_public_env)" = "berubah" ]; then
    echo "Alamat publik di .env diperbarui ke $APP_URL_PUBLIC; aplikasi dan worker dinyalakan ulang."
    stop_app
  fi
else
  echo "Nama codespace tidak terbaca; alamat publik di .env tidak diperiksa. Jalankan skrip ini dari terminal codespace."
fi

wait_for_db

# Skema basis data selalu disamakan dengan kode. Tanpa ini, codespace yang kodenya diperbarui tanpa update.sh menampilkan
# galat 500 setelah masuk karena tabel fase baru belum ada. Aman dijalankan berulang.
if ! php artisan migrate --force --no-interaction >>"$LOG_DIR/app.log" 2>&1; then
  echo "Migrasi basis data gagal; periksa .codespace/logs/app.log."
fi

# setsid melepas proses dari sesi perintah siklus hidup codespace agar tetap berjalan setelah skrip ini selesai.
if app_ready || pgrep -f "artisan serve" >/dev/null; then
  echo "Aplikasi sudah berjalan."
else
  setsid nohup php artisan serve --host=0.0.0.0 --port="$APP_PORT" >>"$LOG_DIR/app.log" 2>&1 </dev/null &
fi
if pgrep -f "artisan queue:work" >/dev/null; then
  echo "Worker sudah berjalan."
else
  setsid nohup php artisan queue:work --tries=3 --sleep=3 >>"$LOG_DIR/worker.log" 2>&1 </dev/null &
fi
# Penjadwal: pengingat survei pukul 08.00 WIB dan cuplikan partisipasi pukul 23.00 WIB (routes/console.php).
if pgrep -f "artisan schedule:work" >/dev/null; then
  echo "Penjadwal sudah berjalan."
else
  setsid nohup php artisan schedule:work >>"$LOG_DIR/scheduler.log" 2>&1 </dev/null &
fi

for _ in $(seq 1 60); do
  if app_ready; then
    echo "NSCAS siap: $APP_URL_PUBLIC/login"
    exit 0
  fi
  sleep 2
done
echo "Aplikasi belum menjawab setelah 2 menit; periksa .codespace/logs/app.log dan storage/logs/laravel.log"
