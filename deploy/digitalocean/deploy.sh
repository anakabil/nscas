#!/usr/bin/env bash
# NSCAS: skrip penempatan, dijalankan DI DALAM Droplet oleh operator (pengguna deploy).
# Panduan lengkap: docs/08-penempatan.md.
#
# Pemakaian:
#   deploy.sh deploy [<ref>]     Memasang versi <ref> (tag, cabang, atau commit). Tanpa <ref>, memasang commit
#                                yang sedang aktif di direktori repositori.
#   deploy.sh rollback           Kembali ke image yang aktif sebelum penempatan terakhir.
#   deploy.sh status             Menampilkan versi yang aktif dan keadaan layanan.
#   deploy.sh artisan <argumen>  Menjalankan php artisan di kontainer aplikasi.
#   deploy.sh compose <argumen>  Menjalankan docker compose dengan berkas env dan image yang aktif.
#
# Urutan kerja "deploy":
#   1. Memeriksa /opt/nscas/.env (izin berkas dan variabel wajib). Nilainya tidak pernah ditampilkan.
#   2. Mengambil kode pada <ref> lalu membangun image, atau menarik image jadi bila NSCAS_IMAGE diisi.
#   3. Tata letak A saja: menyalakan PostgreSQL dan membuat cadangan sebelum migrasi.
#   4. Menjalankan migrasi basis data dengan image baru.
#   5. Mengganti kontainer lalu menunggu sampai sehat. Bila gagal, image sebelumnya dijalankan kembali.
#   6. Mencatat versi yang aktif dan membuang image lama.
# Skrip aman dijalankan ulang: bila tidak ada perubahan, kontainer yang sedang berjalan tidak disentuh.
#
# Variabel lingkungan opsional:
#   NSCAS_HOME           Direktori kerja. Bawaan /opt/nscas.
#   NSCAS_ENV_FILE       Berkas env produksi. Bawaan $NSCAS_HOME/.env.
#   NSCAS_IMAGE          Image jadi dari registry, misalnya registry.digitalocean.com/<nama>/nscas:1.4.0.
#                        Bila diisi, image ditarik dan tidak dibangun di Droplet.
#   NSCAS_SERVICES       Layanan yang dijalankan di server ini. Bawaan "app worker scheduler".
#                        Server web pada tata letak C cukup "app".
#   NSCAS_SKIP_MIGRATE   Isi 1 untuk melewati migrasi (server web tambahan pada tata letak C).
#   NSCAS_SKIP_BACKUP    Isi 1 untuk melewati cadangan sebelum migrasi.
#   NSCAS_ALLOW_DIRTY    Isi 1 untuk mengizinkan build dari direktori yang memiliki perubahan lokal.
#   NSCAS_HEALTH_TIMEOUT Batas waktu menunggu layanan sehat, dalam detik. Bawaan 180.
#   NSCAS_KEEP_IMAGES    Jumlah image lama yang disimpan selain image aktif dan sebelumnya. Bawaan 1.

set -euo pipefail

main() {
    readonly PROJECT="nscas"
    readonly LOCAL_REPOSITORY="nscas"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
    COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"

    NSCAS_HOME="${NSCAS_HOME:-/opt/nscas}"
    ENV_FILE="${NSCAS_ENV_FILE:-${NSCAS_HOME}/.env}"
    RELEASE_FILE="${NSCAS_HOME}/release.env"
    RELEASE_LOG="${NSCAS_HOME}/releases.log"
    LOCK_FILE="${NSCAS_HOME}/.deploy.lock"
    HEALTH_TIMEOUT="${NSCAS_HEALTH_TIMEOUT:-180}"
    KEEP_IMAGES="${NSCAS_KEEP_IMAGES:-1}"

    # Layanan yang dikelola di server ini.
    read -r -a SERVICES <<< "${NSCAS_SERVICES:-app worker scheduler}"

    # Image yang dipakai fungsi compose(). Diisi oleh load_release atau oleh langkah deploy.
    ACTIVE_IMAGE=""
    CURRENT_IMAGE=""
    PREVIOUS_IMAGE=""

    local command="${1:-help}"
    if [ "$#" -gt 0 ]; then
        shift
    fi

    case "${command}" in
        deploy) cmd_deploy "$@" ;;
        rollback) cmd_rollback "$@" ;;
        status) cmd_status "$@" ;;
        artisan) cmd_artisan "$@" ;;
        compose) cmd_compose "$@" ;;
        help | -h | --help) usage ;;
        *)
            usage >&2
            die "Perintah tidak dikenal: ${command}"
            ;;
    esac
}

# ---------------------------------------------------------------------------------------------------------------------
# Alat bantu
# ---------------------------------------------------------------------------------------------------------------------

usage() {
    sed -n '2,13p' "${BASH_SOURCE[0]}" | sed -e 's/^# \{0,1\}//'
}

log() { printf '[deploy] %s %s\n' "$(date '+%H:%M:%S')" "$*"; }
warn() { printf '[deploy] PERINGATAN: %s\n' "$*" >&2; }
die() {
    printf '[deploy] GAGAL: %s\n' "$*" >&2
    exit 1
}

require_tools() {
    local tool
    for tool in "$@"; do
        command -v "${tool}" > /dev/null 2>&1 || die "Perintah '${tool}' tidak ditemukan di server ini."
    done
    docker info > /dev/null 2>&1 || die "Docker tidak dapat dihubungi. Pastikan pengguna ini anggota grup docker."
    docker compose version > /dev/null 2>&1 || die "Plugin docker compose belum terpasang."
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

env_get() { file_get "${ENV_FILE}" "$1"; }

check_env_file() {
    [ -f "${ENV_FILE}" ] || die "Berkas ${ENV_FILE} belum ada. Salin dari deploy/digitalocean/.env.production.example."

    local mode
    mode="$(stat -c '%a' "${ENV_FILE}")"
    case "${mode}" in
        600 | 400) ;;
        *) die "Izin ${ENV_FILE} adalah ${mode}. Berkas berisi rahasia, jalankan: chmod 600 ${ENV_FILE}" ;;
    esac

    local key missing=()
    for key in APP_KEY APP_URL SERVER_NAME DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD; do
        [ -n "$(env_get "${key}")" ] || missing+=("${key}")
    done
    if [ "${#missing[@]}" -gt 0 ]; then
        die "Variabel berikut masih kosong di ${ENV_FILE}: ${missing[*]}"
    fi

    case "$(env_get APP_KEY)" in
        base64:*) ;;
        *) die "APP_KEY harus diawali base64:. Buat dengan: echo \"base64:\$(openssl rand -base64 32)\"" ;;
    esac
    case "$(env_get APP_URL)" in
        https://*) ;;
        *) warn "APP_URL tidak diawali https://. Produksi wajib memakai HTTPS." ;;
    esac
    if [ "$(env_get APP_DEBUG)" = "true" ]; then
        warn "APP_DEBUG=true di berkas env diabaikan. Produksi selalu berjalan dengan APP_DEBUG=false."
    fi
}

single_profile_enabled() {
    case ",$(env_get COMPOSE_PROFILES)," in
        *,single,*) return 0 ;;
        *) return 1 ;;
    esac
}

load_release() {
    CURRENT_IMAGE="$(file_get "${RELEASE_FILE}" NSCAS_IMAGE)"
    PREVIOUS_IMAGE="$(file_get "${RELEASE_FILE}" NSCAS_PREVIOUS_IMAGE)"
    ACTIVE_IMAGE="${CURRENT_IMAGE}"
}

save_release() {
    local image="$1" previous="$2" revision="$3" tmp
    tmp="$(mktemp "${RELEASE_FILE}.XXXXXX")"
    {
        printf '# Dikelola oleh deploy.sh. Jangan diubah dengan tangan.\n'
        printf 'NSCAS_IMAGE=%s\n' "${image}"
        printf 'NSCAS_PREVIOUS_IMAGE=%s\n' "${previous}"
        printf 'NSCAS_REVISION=%s\n' "${revision}"
        printf 'NSCAS_DEPLOYED_AT=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    } > "${tmp}"
    chmod 0644 "${tmp}"
    mv "${tmp}" "${RELEASE_FILE}"
    printf '%s %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${image}" "${revision}" >> "${RELEASE_LOG}"
}

compose() {
    [ -n "${ACTIVE_IMAGE}" ] || die "Belum ada versi yang terpasang. Jalankan: deploy.sh deploy <ref>"
    NSCAS_IMAGE="${ACTIVE_IMAGE}" NSCAS_ENV_FILE="${ENV_FILE}" \
        docker compose --project-name "${PROJECT}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

image_exists() { docker image inspect "$1" > /dev/null 2>&1; }

acquire_lock() {
    if [ "${NSCAS_DEPLOY_LOCKED:-0}" = "1" ]; then
        return 0
    fi
    exec 9> "${LOCK_FILE}"
    flock -n 9 || die "Penempatan lain sedang berjalan (kunci ${LOCK_FILE})."
    export NSCAS_DEPLOY_LOCKED=1
}

# ---------------------------------------------------------------------------------------------------------------------
# deploy
# ---------------------------------------------------------------------------------------------------------------------

resolve_ref() {
    local ref="$1" candidate sha
    for candidate in "refs/remotes/origin/${ref}" "refs/tags/${ref}" "${ref}"; do
        if sha="$(git -C "${APP_DIR}" rev-parse --verify --quiet "${candidate}^{commit}")"; then
            printf '%s' "${sha}"
            return 0
        fi
    done
    return 1
}

checkout_ref() {
    local ref="$1" sha
    log "Mengambil pembaruan repositori."
    git -C "${APP_DIR}" fetch --quiet --prune --tags origin
    sha="$(resolve_ref "${ref}")" || die "Ref '${ref}' tidak ditemukan di repositori."

    if [ -n "$(git -C "${APP_DIR}" status --porcelain --untracked-files=no)" ]; then
        die "Ada perubahan lokal di ${APP_DIR}. Server hanya boleh memuat kode dari repositori. Periksa dengan: git -C ${APP_DIR} status"
    fi
    if [ "$(git -C "${APP_DIR}" rev-parse HEAD)" != "${sha}" ]; then
        git -C "${APP_DIR}" checkout --quiet --detach "${sha}"
        log "Kode berpindah ke ${ref} (${sha:0:12})."
    fi
}

build_image() {
    local sha tag dirty=""
    sha="$(git -C "${APP_DIR}" rev-parse HEAD)"
    if [ -n "$(git -C "${APP_DIR}" status --porcelain --untracked-files=no)" ]; then
        if [ "${NSCAS_ALLOW_DIRTY:-0}" != "1" ]; then
            die "Ada perubahan lokal di ${APP_DIR}. Image produksi harus dibangun dari commit yang bersih."
        fi
        dirty="-dirty-$(date -u '+%Y%m%d%H%M%S')"
        warn "Membangun dari direktori yang memiliki perubahan lokal (NSCAS_ALLOW_DIRTY=1)."
    fi
    tag="${LOCAL_REPOSITORY}:${sha:0:12}${dirty}"
    REVISION="${sha}${dirty}"

    log "Membangun image ${tag}. Langkah ini dapat berlangsung beberapa menit."
    ACTIVE_IMAGE="${tag}"
    NSCAS_REVISION="${REVISION}" compose build --pull app
    NEW_IMAGE="${tag}"
}

pull_image() {
    NEW_IMAGE="${NSCAS_IMAGE}"
    REVISION="${NSCAS_IMAGE}"
    log "Menarik image ${NEW_IMAGE}."
    if ! docker pull --quiet "${NEW_IMAGE}" > /dev/null; then
        image_exists "${NEW_IMAGE}" || die "Image ${NEW_IMAGE} tidak dapat ditarik dan tidak ada di server ini."
        warn "Image tidak dapat ditarik dari registry. Memakai salinan yang sudah ada di server ini."
    fi
}

backup_before_migrate() {
    if [ "${NSCAS_SKIP_BACKUP:-0}" = "1" ]; then
        warn "Cadangan sebelum migrasi dilewati (NSCAS_SKIP_BACKUP=1)."
        return 0
    fi
    if ! single_profile_enabled; then
        log "Managed PostgreSQL: cadangan dan pemulihan ke titik waktu dikelola DigitalOcean."
        return 0
    fi
    if [ ! -f "${NSCAS_HOME}/backup.env" ]; then
        warn "${NSCAS_HOME}/backup.env belum ada, cadangan sebelum migrasi dilewati. Siapkan sebelum data sungguhan masuk."
        return 0
    fi
    log "Membuat cadangan basis data sebelum migrasi."
    "${SCRIPT_DIR}/backup.sh" || die "Cadangan gagal, penempatan dihentikan sebelum migrasi. Lewati hanya dengan NSCAS_SKIP_BACKUP=1."
}

show_recent_logs() {
    warn "Cuplikan log layanan:"
    compose logs --no-color --tail 40 "${SERVICES[@]}" >&2 || true
}

start_services() {
    compose up --detach --remove-orphans --no-build --wait --wait-timeout "${HEALTH_TIMEOUT}" "${SERVICES[@]}"
}

check_public_endpoint() {
    local server_name host
    server_name="$(env_get SERVER_NAME)"
    case "${server_name}" in
        :* | "") return 0 ;;
    esac
    host="${server_name%%,*}"
    host="${host// /}"
    log "Memeriksa https://${host}/up dari dalam server."
    local attempt
    for attempt in $(seq 1 12); do
        if curl --silent --show-error --fail --max-time 10 --output /dev/null \
            --resolve "${host}:443:127.0.0.1" "https://${host}/up" 2> /dev/null; then
            log "HTTPS aktif dengan sertifikat yang sah."
            return 0
        fi
        sleep 5
    done
    warn "https://${host}/up belum menjawab dengan sertifikat yang sah. Periksa DNS (rekaman A harus menunjuk ke server ini), port 80 dan 443, lalu: deploy.sh compose logs app"
}

prune_images() {
    local repository="${NEW_IMAGE%:*}" image kept=0
    while read -r image; do
        [ -n "${image}" ] || continue
        if [ "${image}" = "${CURRENT_IMAGE}" ] || [ "${image}" = "${PREVIOUS_IMAGE}" ]; then
            continue
        fi
        if [ "${kept}" -lt "${KEEP_IMAGES}" ]; then
            kept=$((kept + 1))
            continue
        fi
        docker image rm "${image}" > /dev/null 2>&1 || true
    done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' "${repository}" | grep -v ':<none>$' || true)

    docker image prune --force > /dev/null 2>&1 || true
    docker builder prune --force --filter 'until=168h' > /dev/null 2>&1 || true
}

cmd_deploy() {
    local ref="${1:-}"
    require_tools docker git flock curl stat
    [ -d "${NSCAS_HOME}" ] || die "Direktori ${NSCAS_HOME} belum ada."
    [ -f "${COMPOSE_FILE}" ] || die "Berkas ${COMPOSE_FILE} tidak ditemukan."
    check_env_file
    acquire_lock
    load_release
    local before_image="${CURRENT_IMAGE}"

    # Tahap 1: pindah ke kode yang diminta, lalu jalankan ulang skrip dari versi itu agar langkah
    # berikutnya memakai deploy.sh dan docker-compose.prod.yml milik versi yang dipasang.
    if [ -n "${ref}" ] && [ "${NSCAS_DEPLOY_STAGE:-}" != "2" ]; then
        checkout_ref "${ref}"
        export NSCAS_DEPLOY_STAGE=2
        exec "${SCRIPT_DIR}/deploy.sh" deploy "${ref}"
    fi

    NEW_IMAGE=""
    REVISION=""
    if [ -n "${NSCAS_IMAGE:-}" ]; then
        pull_image
    else
        build_image
    fi
    ACTIVE_IMAGE="${NEW_IMAGE}"

    if single_profile_enabled; then
        log "Tata letak A: memastikan PostgreSQL di Droplet berjalan."
        compose up --detach --no-build --wait --wait-timeout "${HEALTH_TIMEOUT}" postgres
    fi

    if [ "${NSCAS_SKIP_MIGRATE:-0}" = "1" ]; then
        log "Migrasi dilewati (NSCAS_SKIP_MIGRATE=1)."
    else
        backup_before_migrate
        log "Menjalankan migrasi basis data."
        compose run --rm --no-deps migrate || die "Migrasi gagal. Layanan yang sedang berjalan tidak diubah."
    fi

    log "Mengganti kontainer: ${SERVICES[*]}."
    if ! start_services; then
        show_recent_logs
        if [ -n "${before_image}" ] && [ "${before_image}" != "${NEW_IMAGE}" ] && image_exists "${before_image}"; then
            warn "Layanan tidak sehat dengan image baru. Menjalankan kembali ${before_image}."
            ACTIVE_IMAGE="${before_image}"
            start_services || die "Image sebelumnya juga gagal dijalankan. Periksa: deploy.sh compose logs"
            die "Penempatan dibatalkan dan versi sebelumnya berjalan kembali. Migrasi yang sudah dijalankan tidak dibatalkan."
        fi
        die "Layanan tidak sehat dalam ${HEALTH_TIMEOUT} detik. Periksa: deploy.sh compose logs"
    fi

    if [ "${NEW_IMAGE}" != "${before_image}" ]; then
        PREVIOUS_IMAGE="${before_image}"
    fi
    CURRENT_IMAGE="${NEW_IMAGE}"
    save_release "${CURRENT_IMAGE}" "${PREVIOUS_IMAGE}" "${REVISION}"

    check_public_endpoint
    prune_images

    log "Selesai. Versi aktif: ${CURRENT_IMAGE}"
    compose ps
}

# ---------------------------------------------------------------------------------------------------------------------
# rollback, status, artisan, compose
# ---------------------------------------------------------------------------------------------------------------------

cmd_rollback() {
    require_tools docker flock stat
    check_env_file
    acquire_lock
    load_release
    [ -n "${PREVIOUS_IMAGE}" ] || die "Tidak ada versi sebelumnya yang tercatat di ${RELEASE_FILE}."
    image_exists "${PREVIOUS_IMAGE}" || die "Image ${PREVIOUS_IMAGE} sudah tidak ada di server ini. Pasang ulang dengan: deploy.sh deploy <tag sebelumnya>"

    local failed_image="${CURRENT_IMAGE}"
    warn "Rollback hanya mengganti kode. Struktur basis data tidak dikembalikan (lihat docs/08 bagian rollback)."
    log "Menjalankan kembali ${PREVIOUS_IMAGE}."
    ACTIVE_IMAGE="${PREVIOUS_IMAGE}"
    if ! start_services; then
        show_recent_logs
        die "Versi sebelumnya tidak sehat. Periksa: deploy.sh compose logs"
    fi
    CURRENT_IMAGE="${PREVIOUS_IMAGE}"
    PREVIOUS_IMAGE="${failed_image}"
    save_release "${CURRENT_IMAGE}" "${PREVIOUS_IMAGE}" "rollback"
    log "Selesai. Versi aktif: ${CURRENT_IMAGE}"
    compose ps
}

cmd_status() {
    require_tools docker
    load_release
    log "Versi aktif      : ${CURRENT_IMAGE:-belum ada}"
    log "Versi sebelumnya : ${PREVIOUS_IMAGE:-belum ada}"
    log "Dipasang pada    : $(file_get "${RELEASE_FILE}" NSCAS_DEPLOYED_AT)"
    if [ -n "${CURRENT_IMAGE}" ]; then
        compose ps
    fi
}

cmd_artisan() {
    require_tools docker
    load_release
    local tty=()
    if [ ! -t 0 ] || [ ! -t 1 ]; then
        tty=(-T)
    fi
    compose exec "${tty[@]}" app php artisan "$@"
}

cmd_compose() {
    require_tools docker
    load_release
    compose "$@"
}

# Seluruh skrip dibaca ke memori sebelum dijalankan, sehingga aman walaupun git mengganti berkas ini
# di tengah penempatan.
main "$@"
exit $?
