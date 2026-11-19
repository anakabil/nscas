#!/usr/bin/env bash
# NSCAS: cadangan harian basis data untuk tata letak A (PostgreSQL di dalam Droplet, profil compose "single").
# Panduan lengkap: docs/08-penempatan.md bagian cadangan dan uji pemulihan.
#
# Tata letak B dan C memakai DigitalOcean Managed PostgreSQL yang sudah memiliki cadangan harian dan pemulihan
# ke titik waktu. Pada tata letak itu skrip ini berhenti tanpa melakukan apa pun.
#
# Pemakaian:
#   backup.sh                          Membuat cadangan, mengunggahnya, lalu menghapus cadangan yang kedaluwarsa.
#   backup.sh restore-test <sumber>    Uji pemulihan ke PostgreSQL sementara. <sumber> adalah berkas .dump.age
#                                      atau kata "latest" untuk mengunduh cadangan terbaru dari bucket.
#                                      Wajib mengisi AGE_IDENTITY_FILE dengan lokasi kunci privat age.
#                                      Jalankan di laptop administrator, BUKAN di server produksi.
#
# Cara kerja cadangan:
#   pg_dump format custom dijalankan di dalam kontainer postgres, dialirkan langsung ke `age` dengan kunci
#   PUBLIK, sehingga tidak ada salinan yang belum terenkripsi di disk. Hasilnya diunggah dengan s3cmd ke bucket
#   Spaces. Server hanya memegang kunci publik; cadangan hanya dapat dibuka dengan kunci privat yang disimpan
#   di luar server. Cadangan yang lebih tua dari 30 hari dihapus.
#
# Konfigurasi dibaca dari /opt/nscas/backup.env (izin 600), terpisah dari .env aplikasi agar kunci bucket
# cadangan tidak ikut masuk ke kontainer aplikasi:
#   BACKUP_AGE_RECIPIENT    Kunci publik age (diawali age1). Wajib.
#   BACKUP_S3_BUCKET        Nama bucket cadangan, misalnya nscas-backup. Wajib.
#   BACKUP_S3_ACCESS_KEY    Kunci akses Spaces khusus bucket cadangan. Wajib. RAHASIA.
#   BACKUP_S3_SECRET_KEY    Kunci rahasia Spaces. Wajib. RAHASIA.
#   BACKUP_S3_ENDPOINT      Bawaan sgp1.digitaloceanspaces.com (tanpa https://).
#   BACKUP_S3_PREFIX        Bawaan db.
#   BACKUP_RETENTION_DAYS   Bawaan 30.
#   BACKUP_MIN_KEEP         Jumlah cadangan terbaru yang tidak pernah dihapus. Bawaan 7.
#   BACKUP_S3_USE_HTTPS     Bawaan true. Isi false hanya untuk uji lokal.
#   BACKUP_S3_PATH_STYLE    Bawaan false. Isi true untuk penyimpanan yang tidak memakai alamat bucket.domain.

set -euo pipefail
umask 077

NSCAS_HOME="${NSCAS_HOME:-/opt/nscas}"
ENV_FILE="${NSCAS_ENV_FILE:-${NSCAS_HOME}/.env}"
BACKUP_ENV_FILE="${NSCAS_BACKUP_ENV_FILE:-${NSCAS_HOME}/backup.env}"
COMPOSE_PROJECT="${NSCAS_COMPOSE_PROJECT:-nscas}"
WORK_DIR=""
RESTORE_CONTAINER=""

log() { printf '[backup] %s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
warn() { printf '[backup] PERINGATAN: %s\n' "$*" >&2; }
die() {
    printf '[backup] GAGAL: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    if [ -n "${RESTORE_CONTAINER}" ]; then
        docker rm --force --volumes "${RESTORE_CONTAINER}" > /dev/null 2>&1 || true
    fi
    if [ -n "${WORK_DIR}" ] && [ -d "${WORK_DIR}" ]; then
        rm -rf "${WORK_DIR}"
    fi
}
trap cleanup EXIT

require_tools() {
    local tool
    for tool in "$@"; do
        command -v "${tool}" > /dev/null 2>&1 || die "Perintah '${tool}' tidak ditemukan."
    done
}

# Membaca satu nilai dari berkas KEY=VALUE tanpa mengeksekusi isinya. Nilai tidak pernah dicetak ke layar.
file_get() {
    local file="$1" key="$2" line value
    [ -f "${file}" ] || return 0
    line="$(grep -E "^[[:space:]]*${key}=" "${file}" | tail -n 1 || true)"
    value="${line#*=}"
    value="${value%$'\r'}"
    case "${value}" in
        \"*\") value="${value#\"}" && value="${value%\"}" ;;
        \'*\') value="${value#\'}" && value="${value%\'}" ;;
    esac
    printf '%s' "${value}"
}

backup_get() {
    local key="$1" default="${2:-}" value
    value="$(file_get "${BACKUP_ENV_FILE}" "${key}")"
    printf '%s' "${value:-${default}}"
}

check_secret_file() {
    local file="$1" mode
    [ -f "${file}" ] || die "Berkas ${file} belum ada."
    mode="$(stat -c '%a' "${file}")"
    case "${mode}" in
        600 | 400) ;;
        *) die "Izin ${file} adalah ${mode}. Berkas berisi rahasia, jalankan: chmod 600 ${file}" ;;
    esac
}

load_storage_config() {
    check_secret_file "${BACKUP_ENV_FILE}"
    S3_BUCKET="$(backup_get BACKUP_S3_BUCKET)"
    S3_ENDPOINT="$(backup_get BACKUP_S3_ENDPOINT sgp1.digitaloceanspaces.com)"
    S3_ENDPOINT="${S3_ENDPOINT#https://}"
    S3_ENDPOINT="${S3_ENDPOINT#http://}"
    S3_PREFIX="$(backup_get BACKUP_S3_PREFIX db)"
    S3_PREFIX="${S3_PREFIX#/}"
    S3_PREFIX="${S3_PREFIX%/}"
    RETENTION_DAYS="$(backup_get BACKUP_RETENTION_DAYS 30)"
    MIN_KEEP="$(backup_get BACKUP_MIN_KEEP 7)"

    [ -n "${S3_BUCKET}" ] || die "BACKUP_S3_BUCKET belum diisi di ${BACKUP_ENV_FILE}."
    [ -n "$(backup_get BACKUP_S3_ACCESS_KEY)" ] || die "BACKUP_S3_ACCESS_KEY belum diisi di ${BACKUP_ENV_FILE}."
    [ -n "$(backup_get BACKUP_S3_SECRET_KEY)" ] || die "BACKUP_S3_SECRET_KEY belum diisi di ${BACKUP_ENV_FILE}."
    case "${RETENTION_DAYS}" in
        '' | *[!0-9]*) die "BACKUP_RETENTION_DAYS harus berupa angka." ;;
    esac
    case "${MIN_KEEP}" in
        '' | *[!0-9]*) die "BACKUP_MIN_KEEP harus berupa angka." ;;
    esac
}

# Menulis konfigurasi s3cmd sementara (izin 600 karena umask 077) agar kunci tidak muncul di daftar proses.
write_s3cmd_config() {
    local use_https host_bucket
    use_https="$(backup_get BACKUP_S3_USE_HTTPS true)"
    if [ "$(backup_get BACKUP_S3_PATH_STYLE false)" = "true" ]; then
        host_bucket="${S3_ENDPOINT}"
    else
        host_bucket="%(bucket)s.${S3_ENDPOINT}"
    fi
    S3CFG="${WORK_DIR}/s3cfg"
    {
        printf '[default]\n'
        printf 'access_key = %s\n' "$(backup_get BACKUP_S3_ACCESS_KEY)"
        printf 'secret_key = %s\n' "$(backup_get BACKUP_S3_SECRET_KEY)"
        printf 'host_base = %s\n' "${S3_ENDPOINT}"
        printf 'host_bucket = %s\n' "${host_bucket}"
        printf 'use_https = %s\n' "$([ "${use_https}" = "false" ] && echo False || echo True)"
        printf 'check_ssl_certificate = True\n'
        printf 'check_ssl_hostname = True\n'
    } > "${S3CFG}"
}

s3() { s3cmd --config "${S3CFG}" --no-progress "$@"; }

# Daftar kunci objek cadangan, satu per baris, terurut dari yang paling lama.
list_backups() {
    s3 ls --recursive "s3://${S3_BUCKET}/${S3_PREFIX}/" \
        | awk '{ print $NF }' \
        | grep -E '/nscas-[0-9]{8}T[0-9]{6}Z\.dump\.age$' \
        | sort -t/ -k"$(($(printf '%s' "${S3_PREFIX}" | tr -cd '/' | wc -c) + 6))" || true
}

backup_stamp() {
    local name="${1##*/}"
    name="${name#nscas-}"
    printf '%s' "${name%.dump.age}"
}

# ---------------------------------------------------------------------------------------------------------------------
# Cadangan
# ---------------------------------------------------------------------------------------------------------------------

run_backup() {
    require_tools docker age s3cmd stat awk

    [ -f "${ENV_FILE}" ] || die "Berkas ${ENV_FILE} belum ada."
    case ",$(file_get "${ENV_FILE}" COMPOSE_PROFILES)," in
        *,single,*) ;;
        *)
            log "Profil \"single\" tidak aktif. Managed PostgreSQL memiliki cadangan sendiri; tidak ada yang dikerjakan."
            exit 0
            ;;
    esac

    load_storage_config
    local recipient
    recipient="$(backup_get BACKUP_AGE_RECIPIENT)"
    case "${recipient}" in
        age1*) ;;
        AGE-SECRET-KEY-*) die "BACKUP_AGE_RECIPIENT berisi kunci PRIVAT. Server hanya boleh memegang kunci publik (diawali age1). Anggap kunci itu bocor dan buat pasangan kunci baru." ;;
        *) die "BACKUP_AGE_RECIPIENT harus berisi kunci publik age (diawali age1)." ;;
    esac

    local container
    container="$(docker ps --quiet \
        --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
        --filter "label=com.docker.compose.service=postgres" | head -n 1)"
    [ -n "${container}" ] || die "Kontainer postgres proyek ${COMPOSE_PROJECT} tidak berjalan."

    WORK_DIR="$(mktemp -d "${TMPDIR:-/var/tmp}/nscas-backup.XXXXXX")"
    write_s3cmd_config

    local stamp started file object size remote_size
    stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
    started="$(date +%s)"
    file="${WORK_DIR}/nscas-${stamp}.dump.age"
    object="s3://${S3_BUCKET}/${S3_PREFIX}/${stamp:0:4}/${stamp:4:2}/nscas-${stamp}.dump.age"

    log "Membuat pg_dump terenkripsi."
    # shellcheck disable=SC2016
    docker exec "${container}" sh -c 'exec pg_dump --format=custom --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' \
        | age --encrypt --recipient "${recipient}" --output "${file}"

    size="$(stat -c '%s' "${file}")"
    [ "${size}" -gt 1024 ] || die "Berkas cadangan terlalu kecil (${size} byte). Cadangan dibatalkan."
    head -c 21 "${file}" | grep -q '^age-encryption.org/v1' || die "Berkas cadangan tidak terenkripsi dengan benar."

    log "Mengunggah ${object##*/} (${size} byte)."
    s3 put "${file}" "${object}" > /dev/null
    remote_size="$(s3 ls "${object}" | awk '{ print $3; exit }')"
    [ "${remote_size}" = "${size}" ] || die "Ukuran objek di bucket (${remote_size:-tidak ada}) berbeda dari berkas lokal (${size})."

    prune_backups
    log "Selesai dalam $(($(date +%s) - started)) detik: ${object}"
}

prune_backups() {
    local cutoff keys=() key remaining=0 expired=()
    cutoff="$(date -u -d "-${RETENTION_DAYS} days" '+%Y%m%dT%H%M%SZ')"
    mapfile -t keys < <(list_backups)

    for key in "${keys[@]}"; do
        if [[ "$(backup_stamp "${key}")" < "${cutoff}" ]]; then
            expired+=("${key}")
        else
            remaining=$((remaining + 1))
        fi
    done

    if [ "${#expired[@]}" -eq 0 ]; then
        log "Tidak ada cadangan yang lebih tua dari ${RETENTION_DAYS} hari. Tersimpan: ${remaining}."
        return 0
    fi
    if [ "${remaining}" -lt "${MIN_KEEP}" ]; then
        warn "Hanya ada ${remaining} cadangan dalam ${RETENTION_DAYS} hari terakhir (minimum ${MIN_KEEP}). Cadangan lama TIDAK dihapus. Periksa apakah cadangan harian berjalan."
        return 0
    fi
    for key in "${expired[@]}"; do
        s3 del "${key}" > /dev/null
    done
    log "Menghapus ${#expired[@]} cadangan yang lebih tua dari ${RETENTION_DAYS} hari. Tersimpan: ${remaining}."
}

# ---------------------------------------------------------------------------------------------------------------------
# Uji pemulihan
# ---------------------------------------------------------------------------------------------------------------------

run_restore_test() {
    local source="${1:-}"
    [ -n "${source}" ] || die "Pemakaian: AGE_IDENTITY_FILE=<kunci privat> backup.sh restore-test <berkas.dump.age|latest>"
    require_tools docker age stat awk
    [ -n "${AGE_IDENTITY_FILE:-}" ] || die "Isi AGE_IDENTITY_FILE dengan lokasi berkas kunci privat age."
    [ -f "${AGE_IDENTITY_FILE}" ] || die "Berkas kunci ${AGE_IDENTITY_FILE} tidak ditemukan."

    WORK_DIR="$(mktemp -d "${TMPDIR:-/var/tmp}/nscas-restore.XXXXXX")"
    local file="${source}"
    if [ "${source}" = "latest" ]; then
        require_tools s3cmd
        load_storage_config
        write_s3cmd_config
        local latest
        latest="$(list_backups | tail -n 1)"
        [ -n "${latest}" ] || die "Tidak ada cadangan di s3://${S3_BUCKET}/${S3_PREFIX}/."
        file="${WORK_DIR}/${latest##*/}"
        log "Mengunduh ${latest}."
        s3 get "${latest}" "${file}" > /dev/null
    fi
    [ -f "${file}" ] || die "Berkas ${file} tidak ditemukan."

    log "Menyalakan PostgreSQL sementara."
    RESTORE_CONTAINER="nscas-restore-test-$$"
    docker run --detach --name "${RESTORE_CONTAINER}" \
        --env POSTGRES_PASSWORD="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')" \
        postgres:16 > /dev/null
    local attempt ready=0
    for attempt in $(seq 1 60); do
        # Entrypoint image postgres menyalakan server sementara lalu memulai ulang; tunggu sampai server akhir siap.
        if docker exec "${RESTORE_CONTAINER}" sh -c 'pg_isready --quiet --username postgres --host 127.0.0.1' > /dev/null 2>&1; then
            ready=1
            break
        fi
        sleep 1
    done
    [ "${ready}" = "1" ] || die "PostgreSQL sementara tidak siap."

    log "Membuka enkripsi dan memulihkan ${file##*/}."
    age --decrypt --identity "${AGE_IDENTITY_FILE}" "${file}" \
        | docker exec --interactive "${RESTORE_CONTAINER}" \
            pg_restore --no-owner --no-acl --exit-on-error --username postgres --dbname postgres

    local tables migrations
    tables="$(restore_query "select count(*) from information_schema.tables where table_schema = 'public'")"
    migrations="$(restore_query "select count(*) from migrations")"
    log "Tabel di skema public : ${tables}"
    log "Migrasi tercatat       : ${migrations}"
    log "Migrasi terakhir       : $(restore_query "select migration from migrations order by id desc limit 1")"
    log "Jumlah pengguna        : $(restore_query "select count(*) from users")"

    if [ "${tables:-0}" -gt 0 ] && [ "${migrations:-0}" -gt 0 ]; then
        log "LULUS: cadangan dapat dibuka dan dipulihkan."
    else
        die "Cadangan terpulihkan tetapi isinya tidak seperti yang diharapkan."
    fi
}

restore_query() {
    docker exec "${RESTORE_CONTAINER}" psql --username postgres --dbname postgres --tuples-only --no-align \
        --set ON_ERROR_STOP=1 --command "$1"
}

case "${1:-backup}" in
    backup) run_backup ;;
    restore-test)
        shift
        run_restore_test "$@"
        ;;
    -h | --help | help) sed -n '2,13p' "${BASH_SOURCE[0]}" | sed -e 's/^# \{0,1\}//' ;;
    *) die "Perintah tidak dikenal: $1" ;;
esac
