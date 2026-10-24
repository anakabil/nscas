import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionContext } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage() {
  if (await getSessionContext()) redirect("/assessments");
  const t = await getTranslations("auth.login");
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      <LoginForm />
    </section>
  );
}
