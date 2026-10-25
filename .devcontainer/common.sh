# Fungsi bersama skrip Codespaces NSCAS (docs/09). Dimuat dengan source oleh setup.sh, start.sh, dan ports.sh.

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

STATE_DIR=$ROOT/.codespace
LOG_DIR=$STATE_DIR/logs
ACCOUNT_FILE=$STATE_DIR/akun-uji-coba.txt
mkdir -p "$LOG_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f .devcontainer/docker-compose.codespaces.yml)

# Variabel bawaan Codespaces tidak selalu tersedia di perintah siklus hidup (postCreateCommand), sehingga
# dibaca juga dari berkas bersama Codespaces.
codespace_var() {
  local name=$1 value=${!1:-}
  local shared=${NSCAS_CODESPACES_ENV_FILE:-/workspaces/.codespaces/shared/environment-variables.json}
  if [ -z "$value" ] && [ -f "$shared" ]; then
    value=$(node -e 'const v = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[process.argv[2]]; process.stdout.write(typeof v === "string" ? v : "")' "$shared" "$name" 2>/dev/null || true)
  fi
  printf '%s' "$value"
}

# Alamat publik penerus port Codespaces. Tiga variabel NSCAS_* hanya untuk meniru Codespaces saat pengujian lokal.
CODESPACE_NAME=$(codespace_var CODESPACE_NAME)
PUBLIC_SCHEME=${NSCAS_PUBLIC_SCHEME:-https}
FORWARD_DOMAIN=$(codespace_var GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN)
FORWARD_DOMAIN=${FORWARD_DOMAIN:-app.github.dev}
APP_HOST=${NSCAS_APP_HOST:-${CODESPACE_NAME:-localhost}-3000.$FORWARD_DOMAIN}
STORAGE_HOST=${NSCAS_STORAGE_HOST:-${CODESPACE_NAME:-localhost}-9100.$FORWARD_DOMAIN}
APP_URL_PUBLIC=$PUBLIC_SCHEME://$APP_HOST
# Alamat publik hanya dapat dipastikan bila nama codespace diketahui (atau ditetapkan untuk pengujian lokal).
if [ -n "${NSCAS_APP_HOST:-}" ] || [ -n "$CODESPACE_NAME" ]; then PUBLIC_HOST_KNOWN=yes; else PUBLIC_HOST_KNOWN=""; fi

# Menyelaraskan variabel beralamat publik di .env dengan nama codespace saat ini. Mencetak "berubah" bila ada
# yang diperbarui, agar aplikasi dinyalakan ulang dengan alamat yang benar.
sync_public_env() {
  NSCAS_ENV_UPDATES="AUTH_URL=$APP_URL_PUBLIC
APP_URL=$APP_URL_PUBLIC
SERVER_ACTIONS_ALLOWED_ORIGINS=$APP_HOST
S3_PUBLIC_ENDPOINT=$PUBLIC_SCHEME://$STORAGE_HOST
STORAGE_PUBLIC_HOST=$STORAGE_HOST" node -e '
const fs = require("node:fs");
const updates = process.env.NSCAS_ENV_UPDATES.split("\n").map((line) => [line.slice(0, line.indexOf("=")), line]);
const lines = fs.readFileSync(".env", "utf8").split("\n");
let changed = false;
for (const [key, wanted] of updates) {
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index === -1) {
    lines.splice(lines[lines.length - 1] === "" ? lines.length - 1 : lines.length, 0, wanted);
    changed = true;
  } else if (lines[index] !== wanted) {
    lines[index] = wanted;
    changed = true;
  }
}
if (changed) {
  fs.writeFileSync(".env", lines.join("\n"));
  fs.chmodSync(".env", 0o600);
  process.stdout.write("berubah");
}
'
  if [ -f "$ACCOUNT_FILE" ]; then
    sed -i "s#^Alamat aplikasi  : .*#Alamat aplikasi  : $APP_URL_PUBLIC/login#" "$ACCOUNT_FILE"
  fi
}

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
