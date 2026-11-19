# Image ruang kerja Codespaces NSCAS (docs/09): PHP 8.3 dengan ekstensi yang sama dengan image produksi, Node 22,
# dan klien PostgreSQL. Ini bukan image produksi; image produksi dibangun dari Dockerfile di akar repositori.
#
# BASE_IMAGE dapat diganti hanya untuk menguji berkas ini di luar Codespaces.
ARG BASE_IMAGE=mcr.microsoft.com/devcontainers/php:1-8.3-bookworm

FROM node:22-bookworm-slim AS node
FROM mlocati/php-extension-installer:2.13 AS php-extensions

FROM ${BASE_IMAGE}

COPY --from=php-extensions /usr/bin/install-php-extensions /usr/local/bin/install-php-extensions

# Sumber paket Yarn bawaan image dasar dihapus: kunci tanda tangannya sudah tidak berlaku sehingga apt-get update gagal,
# dan proyek ini tidak memakai Yarn (diuji 19 November 2026).
# hadolint ignore=DL3008
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && install-php-extensions bcmath gd intl opcache pcntl pdo_pgsql pgsql zip \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Node 22 disalin dari image resmi, sama seperti tahap aset pada image produksi.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version \
    && npm --version \
    && php -m | grep -qx pdo_pgsql

# Batas unggah sama dengan image produksi: bukti dan rekaman observasi paling besar 25 MB (fase R5). Laravel menolak
# permintaan yang lebih besar dari post_max_size, termasuk unggahan PUT ke penerima aplikasi saat memakai disk lokal.
RUN printf 'upload_max_filesize = 25M\npost_max_size = 32M\n' > "${PHP_INI_DIR:-/usr/local/etc/php}/conf.d/zz-nscas-upload.ini"
