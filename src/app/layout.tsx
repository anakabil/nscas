import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { plusJakartaSans } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s | ${t("name")}` },
    description: t("tagline"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  // Rute bertoken (survei, penilaian mandiri, observasi, kode QR) memasang pesannya sendiri; seluruh pesan
  // konsol tidak dikirim ke peramban responden (docs/05 bagian 3: halaman survei harus ringan).
  const tokenRoute = (await headers()).get("x-nscas-route") === "token";
  const messages = tokenRoute ? { app: (await getMessages()).app } : undefined;

  return (
    <html lang={locale} className={plusJakartaSans.variable}>
      <body>
        <NextIntlClientProvider {...(messages ? { messages } : {})}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
