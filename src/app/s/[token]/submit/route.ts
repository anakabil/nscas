// guard-exempt: survey-token. Responden survei tidak memiliki akun; hak akses adalah token acak 32 byte yang
// hanya disimpan hash-nya (docs/04 bagian 3). Rute ini tidak membaca alamat IP, tidak mencatat isi permintaan,
// dan tidak menulis jejak audit, agar jawaban tidak dapat dihubungkan dengan token (docs/02 bagian 4).

import { z } from "zod";
import { surveySubmissionSchema } from "@/lib/survey/rules";
import { submitSurvey } from "@/lib/survey/service";

const paramsSchema = z.object({ token: z.string().min(1).max(64) });
/** Kiriman wajar berukuran beberapa kilobita; batas ini menolak muatan yang tidak masuk akal. */
const MAX_BODY_BYTES = 64 * 1024;

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return Response.json({ error: "INVALID_TOKEN" }, { status: 404, headers: noStore });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "INVALID_INPUT" }, { status: 413, headers: noStore });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });
  }
  const body = surveySubmissionSchema.safeParse(json);
  if (!body.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });

  const result = await submitSurvey(parsedParams.data.token, body.data);
  if (!result.ok) return Response.json({ error: result.code }, { status: result.status, headers: noStore });
  return Response.json({ ok: true }, { status: 201, headers: noStore });
}
