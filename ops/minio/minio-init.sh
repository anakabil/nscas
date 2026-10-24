#!/bin/sh
# Inisialisasi MinIO produksi (layanan minio-init di docker-compose.prod.yml). Aman dijalankan berulang.
# Membuat bucket privat untuk aplikasi dan akses khusus aplikasi yang hanya berlaku untuk bucket itu, sehingga
# aplikasi tidak memakai kredensial root MinIO.
set -eu

: "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}" "${S3_BUCKET:?}" "${S3_ACCESS_KEY_ID:?}" "${S3_SECRET_ACCESS_KEY:?}"

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set none "local/$S3_BUCKET"

cat > /tmp/nscas-app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:ListBucketMultipartUploads"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    }
  ]
}
EOF

mc admin policy create local nscas-app /tmp/nscas-app-policy.json
mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
# Gagal bila kebijakan sudah terpasang pada pengguna; itu tidak masalah pada jalankan ulang.
mc admin policy attach local nscas-app --user "$S3_ACCESS_KEY_ID" 2>/dev/null || true
echo "MinIO siap: bucket $S3_BUCKET, pengguna aplikasi $S3_ACCESS_KEY_ID dengan kebijakan nscas-app."
