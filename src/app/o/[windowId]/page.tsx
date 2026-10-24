import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { BrandLogo } from "@/components/brand-logo";
import { guardPage, requireRole, requireUser } from "@/lib/auth/guard";
import { rolesFor } from "@/lib/auth/roles";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { loadWindow, windowOpen } from "@/lib/observations/service";
import en from "../../../../messages/en.json";
import id from "../../../../messages/id.json";
import { CaptureApp } from "./capture-app";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ windowId: z.string().min(1).max(64) });

/** Pengambilan observasi untuk satu jendela (docs/01 M6). Hanya koordinator unit jendela dan administrator klien. */
export default async function CapturePage({ params }: { params: Promise<{ windowId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  await guardPage(() => requireUser());
  const window = await loadWindow(parsed.data.windowId);
  if (!window) notFound();
  await guardPage(() => requireRole(window.assessmentId, rolesFor("evidenceAndObservations", "write"), { unitId: window.unitId }));
  const tApp = await getTranslations("app");
  const locale = (await getLocale()) === "en" ? "en" : "id";
  const tz = getAppTimeZone();
  const counts = new Map<string, number>();
  for (const c of window.captures) counts.set(c.checklistItemCode, (counts.get(c.checklistItemCode) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <BrandLogo alt={tApp("logoAlt")} className="h-10" />
      <CaptureApp
        windowId={window.id}
        locale={locale}
        messages={locale === "en" ? en.observeApp : id.observeApp}
        organizationName={window.assessment.organization.name}
        unitName={window.unit.name}
        title={window.title}
        open={windowOpen(window, new Date())}
        period={{ opens: formatDateTime(window.opensAt, tz), closes: formatDateTime(window.closesAt, tz) }}
        checklist={window.checklist.map((c) => ({ ...c, count: counts.get(c.code) ?? 0 }))}
      />
    </main>
  );
}
