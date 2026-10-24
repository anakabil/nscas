import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { guardPage, requireUser } from "@/lib/auth/guard";
import { getAppTimeZone } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { openWindowsForUser } from "@/lib/observations/service";

export const dynamic = "force-dynamic";

/** Halaman awal aplikasi observasi: jendela yang terbuka atau akan dibuka untuk unit pengguna. */
export default async function ObserveHome() {
  const session = await guardPage(() => requireUser());
  const t = await getTranslations("observeApp");
  const tApp = await getTranslations("app");
  const windows = await openWindowsForUser(session.principal.memberships);
  const tz = getAppTimeZone();
  const now = new Date();
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <BrandLogo alt={tApp("logoAlt")} className="h-10" />
      <h1 className="text-brand-navy text-2xl font-bold">{t("listTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("install")}</p>
      {windows.length === 0 ? <p>{t("listEmpty")}</p> : null}
      <ul className="space-y-3">
        {windows.map((w) => (
          <li key={w.id}>
            <Link href={`/o/${w.id}`} className="survey-card block" data-testid="observe-window">
              <span className="block font-semibold">{w.title}</span>
              <span className="text-muted-foreground block text-sm">
                {w.unit.name} · {w.assessment.name}
              </span>
              <span className="block text-sm">{w.opensAt > now ? t("opensAt", { date: formatDateTime(w.opensAt, tz) }) : t("closesAt", { date: formatDateTime(w.closesAt, tz) })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
