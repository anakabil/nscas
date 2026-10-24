#!/bin/sh
# Cadangan harian NSCAS (docs/04 bagian 4, docs/01 bagian 5: harian, disimpan 30 hari, diuji setiap bulan).
#
# 1. pg_dump format custom dialirkan langsung ke age (enkripsi kunci publik) lalu ke penyimpanan objek kedua.
#    Berkas cadangan tanpa enkripsi tidak pernah ditulis ke disk. Kunci privat age tidak disimpan di server.
# 2. Cadangan yang lebih tua dari BACKUP_RETENTION_DAYS hari dihapus.
# 3. Bila BACKUP_MIRROR_OBJECTS=true, berkas bukti dan rekaman disalin (mirror) dari MinIO. Berkas yang dihapus
#    di sumber, termasuk karena pemusnahan data mentah, ikut terhapus di salinan.
#
# Dijalankan di layanan backup (docker-compose.prod.yml) oleh timer systemd ops/systemd/nscas-backup.timer.
# Variabel PG* untuk pg_dump; MC menunjuk klien MinIO (mcli di image Alpine, mc di tempat lain).
set -eu
# pipefail tersedia di BusyBox ash (image Alpine) dan bash; pemeriksaan ukuran di bawah tetap menjadi pengaman.
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}" "${BACKUP_S3_BUCKET:?}"
: "${BACKUP_AGE_RECIPIENT:?}" "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}"
MC="${MC:-mcli}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
export MC_CONFIG_DIR="${MC_CONFIG_DIR:-/tmp/nscas-mc}"

log() { echo "[nscas-backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

"$MC" alias set backup "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY_ID" "$BACKUP_S3_SECRET_ACCESS_KEY" >/dev/null

stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="backup/$BACKUP_S3_BUCKET/db/$(date -u +%Y/%m)/nscas-$stamp.dump.age"
log "pg_dump $PGDATABASE -> $target"
pg_dump --format=custom --no-owner --no-privileges | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" | "$MC" pipe "$target"

size=$("$MC" stat --json "$target" | sed -n 's/.*"size":\([0-9][0-9]*\).*/\1/p' | head -n 1)
if [ "${size:-0}" -lt 1024 ]; then
  log "GAGAL: ukuran cadangan tidak wajar (${size:-0} bita)"
  exit 1
fi
log "cadangan tersimpan, $size bita"

log "menghapus cadangan basis data lebih tua dari $RETENTION_DAYS hari"
"$MC" rm --recursive --force --older-than "${RETENTION_DAYS}d" "backup/$BACKUP_S3_BUCKET/db/" || true

if [ "${BACKUP_MIRROR_OBJECTS:-true}" = "true" ]; then
  : "${SOURCE_S3_ENDPOINT:?}" "${S3_ACCESS_KEY_ID:?}" "${S3_SECRET_ACCESS_KEY:?}" "${S3_BUCKET:?}"
  "$MC" alias set source "$SOURCE_S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
  log "mirror berkas $S3_BUCKET -> $BACKUP_S3_BUCKET/objects"
  "$MC" mirror --overwrite --remove --quiet "source/$S3_BUCKET" "backup/$BACKUP_S3_BUCKET/objects" > /dev/null
fi

log "selesai"
