// guard-exempt: survey-qr. Rute publik untuk pekerja penyedia jasa tanpa akun (docs/01 M2): kode QR unit
// menerbitkan token survei sekali pakai, lalu mengalihkan ke halaman survei. Tidak ada sesi pengguna yang
// dapat diperiksa; keamanan bergantung pada kode acak 32 byte yang hanya disimpan hash-nya, pembatas laju
// di middleware, dan batas penerbitan per kode. Alamat IP tidak dicatat (docs/02 bagian 4).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashToken, looksLikeToken } from "@/lib/privacy/tokens";
import { issueTokenFromQr } from "@/lib/respondents/service";

const paramsSchema = z.object({ code: z.string().refine(looksLikeToken) });

/** Token dari pemindaian sebelumnya disimpan di perangkat ini saja, per kode QR. */
function cookieName(code: string): string {
  return `nscas_q_${hashToken(code).slice(0, 16)}`;
}

/**
 * Pengalihan 303 dengan alamat relatif. Peramban menyelesaikannya terhadap alamat yang dibukanya, sehingga tetap
 * benar di balik proksi yang mengganti header Host (request.url bisa berisi alamat internal).
 */
function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const unavailable = (reason: string) => seeOther(`/q/unavailable?reason=${reason}`);
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return unavailable("INVALID");

  const { code } = parsed.data;
  const store = await cookies();
  const previous = store.get(cookieName(code))?.value ?? null;
  const result = await issueTokenFromQr(code, previous && looksLikeToken(previous) ? previous : null);
  if (!result.ok) return unavailable(result.reason);

  const response = seeOther(`/s/${result.raw}`);
  response.cookies.set(cookieName(code), result.raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/q",
    maxAge: 60 * 60 * 24 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
