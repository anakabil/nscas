import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatePage } from "@/components/state-page";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Halaman untuk alamat yang tidak ada (docs/11 V19). Tautan kembali ke beranda karena pengunjung bisa saja
// responden yang belum masuk.
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <StatePage
      illustration="state-not-found"
      title={t("title")}
      description={t("description")}
      action={
        <Button asChild variant="outline">
          <Link href="/">{t("back")}</Link>
        </Button>
      }
    />
  );
}
