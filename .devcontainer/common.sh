# Fungsi bersama skrip Codespaces NSCAS (docs/09). Dimuat dengan source oleh setup.sh, start.sh, dan ports.sh.

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

STATE_DIR=$ROOT/.codespace
LOG_DIR=$STATE_DIR/logs
ACCOUNT_FILE=$STATE_DIR/akun-uji-coba.txt
mkdir -p "$LOG_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f .devcontainer/docker-compose.codespaces.yml)

# Alamat publik penerus port Codespaces. Tiga variabel NSCAS_* hanya untuk meniru Codespaces saat pengujian lokal.
PUBLIC_SCHEME=${NSCAS_PUBLIC_SCHEME:-https}
FORWARD_DOMAIN=${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}
APP_HOST=${NSCAS_APP_HOST:-${CODESPACE_NAME:-localhost}-3000.$FORWARD_DOMAIN}
STORAGE_HOST=${NSCAS_STORAGE_HOST:-${CODESPACE_NAME:-localhost}-9100.$FORWARD_DOMAIN}
APP_URL_PUBLIC=$PUBLIC_SCHEME://$APP_HOST

step() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }

wait_for_docker() {
  local _
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Docker belum siap setelah 2 menit." >&2
  return 1
}

# Kode status halaman masuk; di bawah 500 berarti aplikasi menjawab.
app_status() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/login || true
}

app_ready() {
  local code
  code=$(app_status)
  [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ]
}
