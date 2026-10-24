# Image produksi NSCAS (docs/08). Satu image untuk aplikasi Next.js dan worker pg-boss; perintahnya berbeda di
# docker-compose.prod.yml. Tahap:
#   deps       seluruh dependensi untuk build
#   build      prisma generate dan next build
#   prod-deps  dependensi produksi saja (termasuk prisma CLI untuk migrasi dan tsx untuk worker)
#   runtime    Node.js 22, Chromium headless untuk PDF laporan dan berita acara, berjalan sebagai pengguna node

# Image dasar dapat diganti bila Docker Hub membatasi unduhan, misalnya
# --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22.22.0-bookworm-slim
ARG NODE_IMAGE=node:22.22.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Jakarta \
    npm_config_update_notifier=false
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Cache build webpack tidak diperlukan saat berjalan (sekitar 400 MB).
RUN npx prisma generate && npm run build && rm -rf .next/cache

FROM base AS prod-deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Biner SWC untuk musl tidak dipakai di image Debian ini.
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force \
    && rm -rf node_modules/@next/swc-*-musl

FROM base AS runtime
# node_modules/.bin di PATH agar perintah seed Prisma (tsx prisma/seed.ts) ditemukan.
ENV NODE_ENV=production \
    PORT=3000 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PATH=/app/node_modules/.bin:$PATH
COPY --from=prod-deps /app/node_modules ./node_modules
# Chromium headless shell versi yang cocok dengan playwright-core, beserta pustaka sistem dan huruf yang diperlukan.
RUN npx playwright-core install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /tmp/*
COPY --chown=node:node package.json package-lock.json next.config.ts prisma.config.ts tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node seed ./seed
COPY --chown=node:node messages ./messages
COPY --chown=node:node public ./public
COPY --chown=node:node src ./src
COPY --from=build --chown=node:node /app/src/generated ./src/generated
COPY --from=build --chown=node:node /app/.next ./.next
RUN mkdir -p /app/.next/cache && chown node:node /app/.next/cache
USER node
EXPOSE 3000
# Aplikasi web. Worker: node --conditions=react-server --import tsx src/worker.ts (lihat docker-compose.prod.yml).
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
