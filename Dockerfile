# syntax=docker/dockerfile:1

# Image produksi NSCAS (Laravel 13, Inertia React, PostgreSQL 16).
#
# Susunan tahap:
#   base     FrankenPHP (PHP 8.3) beserta ekstensi PHP, dipakai bersama oleh semua tahap.
#   vendor   Tahap 1: Composer memasang dependensi PHP tanpa paket pengembangan.
#   assets   Tahap 2: Node 22 membangun aset Vite. Plugin Wayfinder di vite.config.ts menjalankan
#            `php artisan wayfinder:generate`, sehingga tahap ini memakai PHP dan vendor/ dari tahap 1.
#   runtime  Tahap akhir: FrankenPHP mode klasik (tanpa worker), berjalan sebagai pengguna non-root.
#
# Satu image dipakai untuk tiga peran: web (perintah bawaan), worker antrean, dan penjadwal.
# Image tidak memuat rahasia. Seluruh konfigurasi diberikan sebagai variabel lingkungan saat kontainer berjalan.

ARG FRANKENPHP_IMAGE=dunglas/frankenphp:1-php8.3-bookworm
ARG NODE_IMAGE=node:22-bookworm-slim
ARG COMPOSER_IMAGE=composer:2

FROM ${NODE_IMAGE} AS node
FROM ${COMPOSER_IMAGE} AS composer

# ---------------------------------------------------------------------------------------------------------------------
# base: PHP 8.3 dan ekstensi yang dibutuhkan aplikasi
# ---------------------------------------------------------------------------------------------------------------------
FROM ${FRANKENPHP_IMAGE} AS base

RUN install-php-extensions \
        bcmath \
        gd \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_pgsql \
        pgsql \
        zip

WORKDIR /app

# ---------------------------------------------------------------------------------------------------------------------
# vendor (tahap 1): dependensi PHP
# ---------------------------------------------------------------------------------------------------------------------
FROM base AS vendor

# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/local/bin/composer

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_NO_INTERACTION=1 \
    COMPOSER_HOME=/tmp/composer \
    COMPOSER_CACHE_DIR=/tmp/composer-cache

# Langkah pertama hanya bergantung pada composer.json dan composer.lock agar lapisan ini tetap tersimpan
# selama dependensi tidak berubah.
COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/tmp/composer-cache \
    composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-progress

# Kode aplikasi, lalu autoloader teroptimasi dan penemuan paket (skrip post-autoload-dump).
COPY . .
RUN --mount=type=cache,target=/tmp/composer-cache \
    composer install --no-dev --optimize-autoloader --no-progress

# ---------------------------------------------------------------------------------------------------------------------
# assets (tahap 2): aset Vite dengan Node 22
# ---------------------------------------------------------------------------------------------------------------------
FROM base AS assets

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version \
    && npm --version

# .npmrc memuat ignore-scripts=true, sehingga skrip pasca-pasang paket npm tidak dijalankan.
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Kode aplikasi beserta vendor/ agar `php artisan wayfinder:generate` dapat berjalan saat build.
COPY --from=vendor /app ./

# Nama aplikasi yang ditanam ke bundel JavaScript (bukan rahasia).
ARG VITE_APP_NAME=NSCAS
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build

# ---------------------------------------------------------------------------------------------------------------------
# runtime (tahap akhir): FrankenPHP mode klasik, non-root
# ---------------------------------------------------------------------------------------------------------------------
FROM base AS runtime

ARG NSCAS_REVISION=unknown
LABEL org.opencontainers.image.title="NSCAS" \
      org.opencontainers.image.description="Nusa Safety Culture Assessment System" \
      org.opencontainers.image.vendor="PT Nusa Rendra Jayatama" \
      org.opencontainers.image.revision="${NSCAS_REVISION}"

# Nilai bawaan yang aman. Berkas env di server dapat menimpanya, kecuali yang dikunci di docker-compose.prod.yml.
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SERVER_NAME=:8080

# Konfigurasi PHP produksi.
RUN cp "${PHP_INI_DIR}/php.ini-production" "${PHP_INI_DIR}/php.ini"
COPY <<'EOF' /usr/local/etc/php/conf.d/zz-nscas.ini
; NSCAS: pengaturan PHP produksi.
expose_php = Off
variables_order = "EGPCS"
date.timezone = UTC
memory_limit = 256M
max_execution_time = 60

; Unggahan bukti paling besar 25 MB per berkas (docs/01).
upload_max_filesize = 25M
post_max_size = 32M

; OPcache: kode di dalam image tidak berubah, sehingga pemeriksaan waktu ubah berkas dimatikan.
opcache.enable = 1
opcache.enable_cli = 0
opcache.memory_consumption = 192
opcache.interned_strings_buffer = 16
opcache.max_accelerated_files = 20000
opcache.validate_timestamps = 0
opcache.save_comments = 1
opcache.jit = disable

realpath_cache_size = 4096K
realpath_cache_ttl = 600
EOF

# Konfigurasi Caddy untuk FrankenPHP.
#   SERVER_NAME=:8080                    HTTP polos di port 8080 (di belakang penyeimbang beban).
#   SERVER_NAME=nscas.nusasafety.co.id   HTTPS di port 8443 dengan sertifikat otomatis; port 8080 melayani
#                                        tantangan ACME dan pengalihan ke HTTPS.
# Port di dalam kontainer selalu di atas 1024 agar proses non-root tidak memerlukan hak istimewa. Host memetakan
# 80 ke 8080 dan 443 ke 8443. Log akses sengaja tidak diaktifkan: rute survei memuat token di URL, dan catatan
# alamat IP beserta waktu permintaan dapat melemahkan anonimitas responden (CLAUDE.md aturan 2).
COPY <<'EOF' /etc/frankenphp/Caddyfile
{
	admin off
	skip_install_trust
	http_port 8080
	https_port 8443
	grace_period 20s
	servers {
		protocols h1 h2
	}
	{$CADDY_GLOBAL_OPTIONS}
	frankenphp {
		{$FRANKENPHP_CONFIG}
	}
}

# Pendengar internal untuk HEALTHCHECK. Hanya terikat ke 127.0.0.1 di dalam kontainer.
http://:2020 {
	bind 127.0.0.1
	root * /app/public
	php_server
}

{$SERVER_NAME} {
	root * /app/public
	encode zstd br gzip

	request_body {
		max_size 32MB
	}

	# Nilai bawaan untuk berkas statis. Header yang dipasang aplikasi tetap dipakai apa adanya.
	header {
		-Server
		-X-Powered-By
		?X-Content-Type-Options "nosniff"
		?Strict-Transport-Security "max-age=31536000; includeSubDomains"
	}

	# Aset Vite memakai nama berkas ber-hash, aman disimpan lama oleh peramban.
	@build path /build/*
	header @build Cache-Control "public, max-age=31536000, immutable"

	php_server
}
EOF

# Entrypoint: menolak berjalan tanpa APP_KEY, lalu menyusun cache konfigurasi, rute, tampilan, dan event dari
# variabel lingkungan kontainer sebelum menjalankan perintah yang diminta.
COPY --chmod=0755 <<'EOF' /usr/local/bin/nscas-entrypoint
#!/bin/sh
set -eu

cd /app

if [ "${NSCAS_SKIP_BOOT:-0}" != "1" ]; then
    if [ -z "${APP_KEY:-}" ]; then
        echo "[nscas] APP_KEY belum diisi. Isi berkas env di server (lihat docs/08-penempatan.md)." >&2
        exit 78
    fi

    if ! output="$(php artisan optimize --no-ansi 2>&1)"; then
        echo "[nscas] php artisan optimize gagal:" >&2
        echo "${output}" >&2
        exit 1
    fi
fi

exec "$@"
EOF

RUN groupadd --gid 10001 nscas \
    && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /app --shell /usr/sbin/nologin nscas

# Kode aplikasi dimiliki root dan hanya dapat dibaca oleh pengguna aplikasi.
COPY --from=vendor /app /app
COPY --from=assets /app/public/build /app/public/build

# Hanya direktori berikut yang dapat ditulisi saat berjalan: storage/, bootstrap/cache/, serta /data dan /config
# milik Caddy (sertifikat TLS).
RUN mkdir -p \
        storage/app/private \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chown -R nscas:nscas storage bootstrap/cache /data /config

USER nscas

EXPOSE 8080 8443

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --start-interval=2s --retries=4 \
    CMD curl -fsS -o /dev/null http://127.0.0.1:2020/up || exit 1

ENTRYPOINT ["nscas-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile", "--adapter", "caddyfile"]
