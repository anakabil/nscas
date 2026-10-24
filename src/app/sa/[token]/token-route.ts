// Bagian bersama Route Handler /sa/[token]/*: pembacaan JSON berbatas dan respons tanpa singgahan.

import type { TokenChangeResult } from "@/lib/self-assessment/service";

export const noStore = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 32 * 1024;

export async function readJson(request: Request): Promise<unknown | undefined> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function invalidInput(): Response {
  return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });
}

export function toResponse(result: TokenChangeResult): Response {
  if (result.ok) return Response.json({ ok: true }, { headers: noStore });
  return Response.json({ error: result.code, ...(result.missing ? { missing: result.missing } : {}) }, { status: result.status, headers: noStore });
}
