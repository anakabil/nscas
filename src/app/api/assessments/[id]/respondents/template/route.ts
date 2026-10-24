import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { accessErrorResponse, requireRole } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { buildRosterTemplate } from "@/lib/respondents/template";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

/** Templat Excel daftar responden, berisi pilihan unit dan strata asesmen ini. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const access = await requireRole(parsed.data.id, rolesFor("roster", "read"));
    const db = getDb();
    const [units, strata] = await Promise.all([
      db.unit.findMany({
        where: { assessmentId: access.assessmentId, ...(access.unitScope ? { id: { in: access.unitScope } } : {}) },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
      db.stratum.findMany({ where: { assessmentId: access.assessmentId }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
    ]);
    const t = await getTranslations("respondents.template");
    const bytes = await buildRosterTemplate({
      units: units.map((u) => u.name),
      strata,
      optionsSheetName: t("optionsSheet"),
      instructionsSheetName: t("instructionsSheet"),
      instructions: { title: t("title"), lines: Object.values(t.raw("lines") as Record<string, string>) },
    });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="templat-daftar-responden.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
