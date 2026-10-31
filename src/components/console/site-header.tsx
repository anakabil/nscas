import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { getTranslations } from "next-intl/server";
import type { SessionContext } from "@/lib/auth/session";
import { ConsoleMenu, ConsoleNav, type ConsoleNavItem } from "./console-nav";
import { LogoutForm } from "./logout-form";

export async function SiteHeader({ session, showNavigation }: { session: SessionContext; showNavigation: boolean }) {
  const t = await getTranslations();
  const canSeeOrganizations =
    session.principal.isSuperAdmin ||
    session.principal.memberships.some((m) => m.role === "LEAD_ASSESSOR" || m.role === "CLIENT_ADMIN");

  const items: ConsoleNavItem[] = [
    { href: "/assessments", label: t("nav.assessments") },
    ...(canSeeOrganizations ? [{ href: "/orgs", label: t("nav.organizations") }] : []),
    ...(session.principal.isSuperAdmin ? [{ href: "/retention", label: t("nav.retention") }] : []),
    { href: "/account", label: t("nav.account") },
  ];
  const signedInAs = t("nav.signedInAs", { name: session.user.name });

  return (
    <header className="bg-brand-navy-deep text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href={showNavigation ? "/assessments" : "/account"} className="shrink-0">
          <BrandLogo alt={t("app.logoAlt")} framed={false} className="h-8" />
        </Link>
        {showNavigation ? <ConsoleNav items={items} label={t("nav.mainNavigation")} /> : null}
        <div className={showNavigation ? "ml-auto hidden items-center gap-3 md:flex" : "ml-auto flex items-center gap-3"}>
          <span className="hidden text-sm text-white/70 lg:inline">{signedInAs}</span>
          <LogoutForm tone="dark" />
        </div>
        {showNavigation ? (
          <ConsoleMenu items={items} label={t("nav.mainNavigation")} menuLabel={t("nav.menu")} signedInAs={signedInAs} logout={<LogoutForm />} />
        ) : null}
      </div>
    </header>
  );
}
