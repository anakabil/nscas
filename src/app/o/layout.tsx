import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { ServiceWorker } from "./service-worker";
import { PALETTE } from "@/lib/theme";

// Aplikasi observasi digital (docs/01 M6): dapat dipasang sebagai PWA dengan cakupan /o.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("observeApp");
  return {
    title: t("metaTitle"),
    manifest: "/o/manifest.webmanifest",
    appleWebApp: { capable: true, title: t("manifest.shortName"), statusBarStyle: "default" },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: PALETTE.navyDeep, width: "device-width", initialScale: 1 };

export default function ObserveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorker />
      {children}
    </>
  );
}
