// guard-exempt: survey-token. Dipanggil halaman survei setelah dimuat di peramban (bukan oleh pratinjau
// tautan aplikasi pesan), untuk menandai bahwa tautan pernah dibuka. Waktunya dibulatkan ke jam.

import { z } from "zod";
import { markSurveyOpened } from "@/lib/survey/service";

const paramsSchema = z.object({ token: z.string().min(1).max(64) });

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (parsed.success) await markSurveyOpened(parsed.data.token);
  // Selalu 204 agar keberadaan token tidak dapat ditebak dari rute ini.
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
