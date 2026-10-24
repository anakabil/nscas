import "server-only";
import { createHash } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageEnv } from "@/lib/env";

// Klien penyimpanan objek kompatibel S3 (MinIO saat pengembangan).
// Kunci objek mengikuti docs/02 bagian 5: {organizationId}/{assessmentId}/{kind}/{cuid}.{ext}
// Unggah langsung dari peramban memakai URL bertanda tangan berumur pendek; server memverifikasi ukuran,
// jenis berdasarkan isi, dan SHA-256 setelah unggah. Unduhan selalu lewat route handler yang memeriksa hak
// akses lalu mengalihkan ke URL bertanda tangan 5 menit.
const globalForStorage = globalThis as unknown as { s3?: S3Client; s3Public?: S3Client };

function client(endpoint: string): S3Client {
  const env = getStorageEnv();
  return new S3Client({
    endpoint,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}

export function getStorage(): S3Client {
  globalForStorage.s3 ??= client(getStorageEnv().S3_ENDPOINT);
  return globalForStorage.s3;
}

/** Klien untuk menandatangani URL yang dibuka peramban (alamat publik bisa berbeda dari alamat internal). */
function getPublicStorage(): S3Client {
  const env = getStorageEnv();
  if (!env.S3_PUBLIC_ENDPOINT) return getStorage();
  globalForStorage.s3Public ??= client(env.S3_PUBLIC_ENDPOINT);
  return globalForStorage.s3Public;
}

export function getBucket(): string {
  return getStorageEnv().S3_BUCKET;
}

/** Asal (origin) penyimpanan objek untuk Content-Security-Policy. */
export function storageOrigin(): string | null {
  try {
    const env = getStorageEnv();
    return new URL(env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT).origin;
  } catch {
    return null;
  }
}

export async function pingStorage(): Promise<void> {
  await getStorage().send(new HeadBucketCommand({ Bucket: getBucket() }));
}

export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/** URL PUT bertanda tangan; ukuran dan jenis yang dinyatakan ikut ditandatangani. */
export async function presignUpload(key: string, contentType: string, size: number): Promise<{ url: string; headers: Record<string, string> }> {
  const sse = getStorageEnv().S3_SSE;
  const command = new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType, ContentLength: size, ...(sse ? { ServerSideEncryption: sse } : {}) });
  const url = await getSignedUrl(getPublicStorage(), command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  return { url, headers: { "Content-Type": contentType, ...(sse ? { "x-amz-server-side-encryption": sse } : {}) } };
}

export async function presignDownload(key: string, fileName: string, inline = false): Promise<string> {
  const safe = fileName.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(0, 150) || "berkas";
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(safe)}`,
  });
  return getSignedUrl(getPublicStorage(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

export interface ObjectInspection {
  size: number;
  sha256: string;
  /** Sekitar 64 KB pertama untuk mendeteksi jenis berkas dari isinya. */
  head: Uint8Array;
}

/** Membaca objek yang baru diunggah: ukuran sebenarnya, SHA-256 seluruh isi, dan potongan awal. Null bila tidak ada. */
export async function inspectObject(key: string, maxBytes: number): Promise<ObjectInspection | null> {
  let size: number;
  try {
    const head = await getStorage().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    size = head.ContentLength ?? 0;
  } catch {
    return null;
  }
  if (size > maxBytes) return { size, sha256: "", head: new Uint8Array() };
  const object = await getStorage().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  const hash = createHash("sha256");
  const headChunks: Uint8Array[] = [];
  let headLength = 0;
  let total = 0;
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
    total += chunk.length;
    if (headLength < 64 * 1024) {
      headChunks.push(chunk);
      headLength += chunk.length;
    }
  }
  const head = new Uint8Array(Buffer.concat(headChunks).subarray(0, 64 * 1024));
  return { size: total, sha256: hash.digest("hex"), head };
}

export async function deleteObject(key: string): Promise<void> {
  await getStorage().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/** Unggah dari server (misalnya PDF laporan hasil render). */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const sse = getStorageEnv().S3_SSE;
  await getStorage().send(
    new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType, ContentLength: body.byteLength, ...(sse ? { ServerSideEncryption: sse } : {}) }),
  );
}
