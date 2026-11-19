# Fungsi bersama skrip Codespaces NSCAS (docs/09). Dimuat dengan source oleh setup.sh, start.sh, dan ports.sh.

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

STATE_DIR=$ROOT/.codespace
LOG_DIR=$STATE_DIR/logs
ACCOUNT_FILE=$STATE_DIR/akun-uji-coba.txt
APP_PORT=8000
mkdir -p "$LOG_DIR"
chmod 700 "$STATE_DIR"

# Variabel bawaan Codespaces tidak selalu tersedia di perintah siklus hidup (postCreateCommand), sehingga dibaca juga
# dari berkas bersama Codespaces.
codespace_var() {
  local name=$1 value=${!1:-}
  local shared=${NSCAS_CODESPACES_ENV_FILE:-/workspaces/.codespaces/shared/environment-variables.json}
  if [ -z "$value" ] && [ -f "$shared" ]; then
    value=$(php -r '$v = json_decode((string) file_get_contents($argv[1]), true)[$argv[2]] ?? ""; echo is_string($v) ? $v : "";' -- "$shared" "$name" 2>/dev/null || true)
  fi
  printf '%s' "$value"
}

# Alamat publik penerus port Codespaces. NSCAS_PUBLIC_URL hanya untuk meniru Codespaces saat pengujian di luar
# Codespaces.
CODESPACE_NAME=$(codespace_var CODESPACE_NAME)
FORWARD_DOMAIN=$(codespace_var GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN)
FORWARD_DOMAIN=${FORWARD_DOMAIN:-app.github.dev}
if [ -n "${NSCAS_PUBLIC_URL:-}" ]; then
  APP_URL_PUBLIC=$NSCAS_PUBLIC_URL
  PUBLIC_HOST_KNOWN=yes
elif [ -n "$CODESPACE_NAME" ]; then
  APP_URL_PUBLIC=https://$CODESPACE_NAME-$APP_PORT.$FORWARD_DOMAIN
  PUBLIC_HOST_KNOWN=yes
else
  APP_URL_PUBLIC=http://localhost:$APP_PORT
  PUBLIC_HOST_KNOWN=""
fi

step() { printf '\n== %s %s\n' "$(date '+%H:%M:%S')" "$*"; }

# Mengganti atau menambah satu baris KUNCI=nilai di .env. Berhasil (status 0) hanya bila isinya berubah.
set_env() {
  local key=$1 value=$2
  if grep -Fqx "$key=$value" .env; then
    return 1
  fi
  if grep -q "^$key=" .env; then
    local escaped=${value//\\/\\\\}
    escaped=${escaped//#/\\#}
    escaped=${escaped//&/\\&}
    sed -i "s#^$key=.*#$key=$escaped#" .env
  else
    printf '%s=%s\n' "$key" "$value" >>.env
  fi
  return 0
}

# Menyelaraskan alamat publik di .env dengan nama codespace saat ini. Mencetak "berubah" bila ada yang diperbarui,
# agar aplikasi dinyalakan ulang dengan alamat yang benar.
sync_public_env() {
  local secure=false changed=""
  case "$APP_URL_PUBLIC" in https://*) secure=true ;; esac
  set_env APP_URL "$APP_URL_PUBLIC" && changed=yes
  set_env SESSION_SECURE_COOKIE "$secure" && changed=yes
  if [ -f "$ACCOUNT_FILE" ]; then
    sed -i "s#^Alamat aplikasi  : .*#Alamat aplikasi  : $APP_URL_PUBLIC/login#" "$ACCOUNT_FILE"
  fi
  if [ -n "$changed" ]; then
    printf 'berubah'
  fi
}

wait_for_db() {
  local _
  for _ in $(seq 1 60); do
    pg_isready -q -h 127.0.0.1 -U nscas -d nscas && return 0
    sleep 2
  done
  echo "PostgreSQL belum siap setelah 2 menit." >&2
  return 1
}

app_ready() {
  curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$APP_PORT/up" 2>/dev/null
}

stop_app() {
  pkill -f "artisan serve" 2>/dev/null || true
  pkill -f "Illuminate/Foundation/resources/server.php" 2>/dev/null || true
  pkill -f "artisan queue:work" 2>/dev/null || true
  pkill -f "artisan schedule:work" 2>/dev/null || true
  sleep 2
}
