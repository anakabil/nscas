// Pembatas laju jendela tetap di memori proses (satu server, docs/02 bagian 7).
// Kunci disimpan sebagai hash oleh pemanggil bila berisi data pribadi (misalnya alamat IP).

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly maxKeys = 50_000,
  ) {}

  consume(key: string, now: number = Date.now()): RateLimitResult {
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size >= this.maxKeys) this.prune(now);
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    const allowed = entry.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - entry.count),
      retryAfterMs: allowed ? 0 : entry.resetAt - now,
    };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private prune(now: number): void {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    // Bila masih penuh, buang entri tertua agar memori tetap terbatas.
    while (this.hits.size >= this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
  }
}

const MINUTE = 60 * 1000;
const globalLimiters = globalThis as unknown as { nscasRateLimiters?: Record<string, FixedWindowRateLimiter> };

function shared(name: string, limit: number, windowMs: number): FixedWindowRateLimiter {
  globalLimiters.nscasRateLimiters ??= {};
  return (globalLimiters.nscasRateLimiters[name] ??= new FixedWindowRateLimiter(limit, windowMs));
}

/** docs/04 bagian 5: masuk 10 per menit per akun. */
export const loginRateLimiter = shared("login", 10, MINUTE);
/** docs/04 bagian 5: unggah 30 per menit per pengguna (dipakai mulai Fase 5). */
export const uploadRateLimiter = shared("upload", 30, MINUTE);
/** docs/04 bagian 5: rute survei 60 permintaan per menit per hash IP. */
export const SURVEY_RATE_LIMIT = { limit: 60, windowMs: MINUTE } as const;
