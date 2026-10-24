#!/bin/sh
# Uji pemulihan cadangan NSCAS (docs/01 bagian 5: diuji setiap bulan). Dijalankan di mesin administrator yang
# memegang kunci privat age, BUKAN di server produksi. Mengunduh cadangan terbaru (atau BACKUP_OBJECT tertentu),
# membuka enkripsinya, memulihkannya ke PostgreSQL sementara di direktori kerja, menjalankan pemeriksaan
# (checks.sql), lalu menghapus seluruh data sementara.
#
#   AGE_IDENTITY=/jalur/kunci-age.txt BACKUP_S3_ENDPOINT=... BACKUP_S3_ACCESS_KEY_ID=... \
#   BACKUP_S3_SECRET_ACCESS_KEY=... BACKUP_S3_BUCKET=nscas-backup sh ops/backup/restore-test.sh
#
# Memerlukan: age, klien MinIO (MC, bawaan mcli), dan biner server PostgreSQL 16 (initdb, pg_ctl, pg_restore,
# psql) di PATH atau di PG_BIN. Image ops/backup memuat semuanya.
set -eu
# pipefail tersedia di BusyBox ash (image Alpine) dan bash; pemeriksaan ukuran di bawah tetap menjadi pengaman.
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

: "${AGE_IDENTITY:?}" "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}" "${BACKUP_S3_BUCKET:?}"
MC="${MC:-mcli}"
PG_BIN="${PG_BIN:-}"
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
CHECKS="${CHECKS_SQL:-$SCRIPT_DIR/checks.sql}"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/nscas-restore.XXXXXX")
export MC_CONFIG_DIR="$WORK/mc"
PORT="${RESTORE_PORT:-55432}"

log() { echo "[nscas-restore-test] $*"; }
# Menjalankan program PostgreSQL dari PG_BIN bila diisi, selain itu dari PATH.
pg() { prog=$1; shift; if [ -n "$PG_BIN" ]; then "$PG_BIN/$prog" "$@"; else "$prog" "$@"; fi; }
cleanup() {
  pg pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

"$MC" alias set backup "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY_ID" "$BACKUP_S3_SECRET_ACCESS_KEY" >/dev/null

object="${BACKUP_OBJECT:-}"
if [ -z "$object" ]; then
  object=$("$MC" find "backup/$BACKUP_S3_BUCKET/db/" --name "nscas-*.dump.age" | sort | tail -n 1)
fi
[ -n "$object" ] || { log "GAGAL: tidak ada cadangan di backup/$BACKUP_S3_BUCKET/db/"; exit 1; }
log "cadangan: $object"

"$MC" cat "$object" | age --decrypt --identity "$AGE_IDENTITY" > "$WORK/nscas.dump"
log "dibuka: $(wc -c < "$WORK/nscas.dump") bita"

pg initdb --pgdata="$WORK/data" --username=restore --auth=trust --encoding=UTF8 --locale=C >/dev/null
pg pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/postgres.log" -w start >/dev/null
pg createdb -h "$WORK" -p "$PORT" -U restore nscas
pg pg_restore --no-owner --no-privileges --exit-on-error -h "$WORK" -p "$PORT" -U restore -d nscas "$WORK/nscas.dump"
log "dipulihkan ke basis data sementara"

pg psql -h "$WORK" -p "$PORT" -U restore -d nscas -v ON_ERROR_STOP=1 -X -q -f "$CHECKS"
log "LULUS: cadangan dapat dipulihkan dan lolos pemeriksaan"
