// guard-exempt: pwa-manifest. Manifest aplikasi observasi (docs/01 M6) yang dapat dipasang di layar utama.
// Tidak memuat data apa pun selain nama dan ikon aplikasi.

import { getLocale, getTranslations } from "next-intl/server";

export async function GET() {
  const t = await getTranslations("observeApp.manifest");
  return Response.json(
    {
      name: t("name"),
      short_name: t("shortName"),
      description: t("description"),
      lang: await getLocale(),
      start_url: "/o",
      scope: "/o",
      display: "standalone",
      orientation: "portrait",
      background_color: "#f5f6fb",
      theme_color: "#000b9d",
      icons: [
        { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
