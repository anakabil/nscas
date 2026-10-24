import "server-only";
import { z } from "zod";

// Variabel lingkungan dibaca per kelompok dan secara malas, agar halaman yang
// tidak membutuhkannya (misalnya /health saat .env belum lengkap) tetap berjalan.

const databaseSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /**
   * Jumlah koneksi basis data paling banyak per proses. Bawaan 20; hasil uji beban 300 pengisian serentak di
   * docs/07. Jumlah seluruh proses (aplikasi dan worker) harus di bawah max_connections PostgreSQL.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(200).default(20),
});

const storageSchema = z.object({
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** Alamat penyimpanan objek yang dijangkau peramban untuk URL bertanda tangan; bawaan sama dengan S3_ENDPOINT. */
  S3_PUBLIC_ENDPOINT: z.url().optional().or(z.literal("").transform(() => undefined)),
  /** Enkripsi sisi server, misalnya AES256 (docs/02 bagian 5). Kosong bila penyedia mengenkripsi secara bawaan. */
  S3_SSE: z.enum(["AES256", "aws:kms"]).optional().or(z.literal("").transform(() => undefined)),
});

export type DatabaseEnv = z.infer<typeof databaseSchema>;
export type StorageEnv = z.infer<typeof storageSchema>;

export class MissingEnvError extends Error {
  constructor(group: string, keys: string[]) {
    super(`Missing or invalid environment variables for ${group}: ${keys.join(", ")}`);
    this.name = "MissingEnvError";
  }
}

function parseGroup<T extends z.ZodObject>(group: string, schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new MissingEnvError(group, keys);
  }
  return result.data;
}

export function getDatabaseEnv(): DatabaseEnv {
  return parseGroup("database", databaseSchema);
}

export function getStorageEnv(): StorageEnv {
  return parseGroup("storage", storageSchema);
}

export function getAppTimeZone(): string {
  return process.env.APP_TIMEZONE || "Asia/Jakarta";
}
