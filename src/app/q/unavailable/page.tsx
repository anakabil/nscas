import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { BrandLogo } from "@/components/brand-logo";
import { TokenArt } from "@/components/token-art";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("qrScan");
  return { title: t("title") };
}

const reasonSchema = z.enum(["INVALID", "CLOSED", "LIMIT"]).catch("INVALID");

/** Pemberitahuan untuk kode QR yang tidak berlaku, survei yang belum atau sudah ditutup, atau kuota habis. */
export default async function QrUnavailablePage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const reason = reasonSchema.parse((await searchParams).reason);
  const t = await getTranslations("qrScan");
  const tApp = await getTranslations("app");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <BrandLogo alt={tApp("logoAlt")} className="h-10 self-start" />
      <TokenArt name="unavailable" priority />
      <h1 className="text-brand-navy text-xl font-bold">{t("title")}</h1>
      <p data-testid="qr-unavailable" data-reason={reason}>
        {t(`reasons.${reason}`)}
      </p>
      <p className="text-muted-foreground text-sm">{t("help")}</p>
    </main>
  );
}
