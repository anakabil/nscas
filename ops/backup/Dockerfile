# Image cadangan NSCAS (layanan backup di docker-compose.prod.yml): pg_dump dan server PostgreSQL 16 dari image
# resmi, age untuk enkripsi kunci publik, dan klien MinIO (mcli) untuk penyimpanan objek kedua.
ARG POSTGRES_IMAGE=postgres:16-alpine
FROM ${POSTGRES_IMAGE}
RUN apk add --no-cache age minio-client tzdata
ENV TZ=Asia/Jakarta MC=mcli
COPY backup.sh /usr/local/bin/nscas-backup
COPY restore-test.sh /usr/local/bin/nscas-restore-test
COPY checks.sql /usr/local/share/nscas/checks.sql
RUN chmod 0755 /usr/local/bin/nscas-backup /usr/local/bin/nscas-restore-test
ENV CHECKS_SQL=/usr/local/share/nscas/checks.sql
# initdb pada uji pemulihan tidak boleh berjalan sebagai root.
USER postgres
WORKDIR /tmp
ENTRYPOINT ["/usr/local/bin/nscas-backup"]
