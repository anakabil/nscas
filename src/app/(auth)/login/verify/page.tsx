import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { readLoginChallenge } from "../challenge";
import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verify");
  return { title: t("title") };
}

export default async function VerifyPage() {
  if (!(await readLoginChallenge())) redirect("/login");
  const t = await getTranslations("auth.verify");
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      <VerifyForm />
      <Link href="/login" className="text-brand-navy text-sm font-semibold underline-offset-4 hover:underline">
        {t("back")}
      </Link>
    </section>
  );
}
