import { NextResponse, type NextRequest } from "next/server";
import { SURVEY_RATE_LIMIT } from "@/lib/rate-limit";
import { buildContentSecurityPolicy, securityHeaders, SURVEY_PATH } from "@/lib/security-headers";

// Header keamanan dan pembatas laju rute survei (docs/04 bagian 5).
// Pemeriksaan hak akses TIDAK dilakukan di sini; seluruhnya di server melalui src/lib/auth/guard.ts.

const development = process.env.NODE_ENV !== "production";

// Pembatas laju rute survei: kunci berupa hash SHA-256 dari IP dengan garam acak di memori yang berganti
// setiap hari, sehingga hash tidak dapat dihubungkan antarhari dan tidak pernah disimpan (docs/02 bagian 4).
let salt = { value: crypto.randomUUID(), day: new Date().toISOString().slice(0, 10) };
const surveyHits = new Map<string, { count: number; resetAt: number }>();

async function hashIp(ip: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  if (salt.day !== today) {
    salt = { value: crypto.randomUUID(), day: today };
    surveyHits.clear();
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt.value}:${ip}`));
  return Array.from(new Uint8Array(digest.slice(0, 16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function surveyRateLimited(request: NextRequest): Promise<number | null> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = await hashIp(ip);
  const now = Date.now();
  let entry = surveyHits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (surveyHits.size > 50_000) surveyHits.clear();
    entry = { count: 0, resetAt: now + SURVEY_RATE_LIMIT.windowMs };
    surveyHits.set(key, entry);
  }
  entry.count += 1;
  return entry.count > SURVEY_RATE_LIMIT.limit ? Math.ceil((entry.resetAt - now) / 1000) : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = securityHeaders(pathname, { development });

  if (SURVEY_PATH.test(pathname)) {
    const retryAfter = await surveyRateLimited(request);
    if (retryAfter !== null) {
      return new NextResponse("Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.", {
        status: 429,
        headers: { ...headers, "Retry-After": String(retryAfter), "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy(nonce, { development });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    // Semua rute kecuali aset statis Next.js dan berkas di public/.
    { source: "/((?!_next/static|_next/image|brand/|icon.png|favicon.ico).*)" },
  ],
};
