// guard-exempt: pwa-manifest. Manifest aplikasi observasi (docs/01 M6) yang dapat dipasang di layar utama.
// Tidak memuat data apa pun selain nama dan ikon aplikasi.

import { getLocale, getTranslations } from "next-intl/server";
import { PALETTE } from "@/lib/theme";

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
      background_color: PALETTE.surfaceAlt,
      theme_color: PALETTE.navyDeep,
      icons: [
        // Logo aplikasi NSCAS (docs/11 bagian 5): bidang biru batu gelap penuh sampai tepi, simbol di zona aman 80 persen,
        // sehingga satu berkas sah sebagai ikon biasa maupun ikon bertopeng (maskable).
        { src: "/brand/nscas-app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/brand/nscas-app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/brand/nscas-app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
