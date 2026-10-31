import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatePage } from "@/components/state-page";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Halaman untuk alamat yang tidak ada (docs/11 V19). Tautan kembali ke beranda karena pengunjung bisa saja
// responden yang belum masuk. Halaman ini batas milik layout akar, sehingga rujukan komponen kliennya ikut ke
// setiap rute, termasuk survei. Karena itu tautannya elemen a biasa, bukan next/link: next/link di sini menarik
// sekitar 17 KB JavaScript konsol ke halaman survei (docs/05 bagian 3, batas 350 KB).
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <StatePage
      illustration="state-not-found"
      title={t("title")}
      description={t("description")}
      action={
        <Button asChild variant="outline">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- lihat catatan di atas. */}
          <a href="/">{t("back")}</a>
        </Button>
      }
    />
  );
}
