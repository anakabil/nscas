import "server-only";
import { headers } from "next/headers";
import type { RequestMeta } from "@/lib/audit";
import { keyedHash } from "@/lib/privacy/crypto";

/** Alamat klien dari header proksi (Caddy di produksi). */
export function clientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || null;
}

/**
 * Metadata permintaan untuk jejak audit: hash alamat IP berkunci (bukan alamat mentah) dan agen pengguna.
 * Tidak dipakai pada rute survei, yang sama sekali tidak menyimpan alamat IP (docs/02 bagian 4).
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip = clientIp(h);
  return {
    ipHash: ip ? keyedHash(ip, "audit-ip").slice(0, 32) : null,
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
  };
}
