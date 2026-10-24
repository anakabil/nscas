import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { getTranslations } from "next-intl/server";
import type { SessionContext } from "@/lib/auth/session";
import { LogoutForm } from "./logout-form";

export async function SiteHeader({ session, showNavigation }: { session: SessionContext; showNavigation: boolean }) {
  const t = await getTranslations();
  const canSeeOrganizations =
    session.principal.isSuperAdmin ||
    session.principal.memberships.some((m) => m.role === "LEAD_ASSESSOR" || m.role === "CLIENT_ADMIN");

  return (
    <header className="border-border bg-card border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
        <Link href={showNavigation ? "/assessments" : "/account"} className="shrink-0">
          <BrandLogo alt={t("app.logoAlt")} className="h-10" />
        </Link>
        {showNavigation ? (
          <nav aria-label={t("nav.mainNavigation")} className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            <Link href="/assessments" className="hover:bg-tint rounded-md px-3 py-2">
              {t("nav.assessments")}
            </Link>
            {canSeeOrganizations ? (
              <Link href="/orgs" className="hover:bg-tint rounded-md px-3 py-2">
                {t("nav.organizations")}
              </Link>
            ) : null}
            <Link href="/account" className="hover:bg-tint rounded-md px-3 py-2">
              {t("nav.account")}
            </Link>
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {t("nav.signedInAs", { name: session.user.name })}
          </span>
          <LogoutForm />
        </div>
      </div>
    </header>
  );
}
