import "server-only";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { getStorageEnv } from "@/lib/env";

// Klien penyimpanan objek kompatibel S3 (MinIO saat pengembangan).
// Kunci objek mengikuti docs/02 bagian 5: {organizationId}/{assessmentId}/{kind}/{cuid}.{ext}
const globalForStorage = globalThis as unknown as { s3?: S3Client };

export function getStorage(): S3Client {
  if (!globalForStorage.s3) {
    const env = getStorageEnv();
    globalForStorage.s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return globalForStorage.s3;
}

export function getBucket(): string {
  return getStorageEnv().S3_BUCKET;
}

export async function pingStorage(): Promise<void> {
  await getStorage().send(new HeadBucketCommand({ Bucket: getBucket() }));
}
