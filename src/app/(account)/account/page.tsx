import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guard";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  // Layout grup (account) sudah memastikan pengguna masuk.
  const session = await requireUser({ allowSetupPending: true });
  const t = await getTranslations();
  const ready = !session.totpPending && !session.user.mustChangePassword;

  return (
    <>
      <h1 className="text-brand-navy text-2xl font-bold">{t("account.title")}</h1>

      {session.user.mustChangePassword ? <Alert variant="warning">{t("account.mustChangePassword")}</Alert> : null}
      {session.totpPending ? (
        <Alert variant="warning" className="flex flex-wrap items-center justify-between gap-3">
          <span>{t("account.totpRequired")}</span>
          <Button asChild size="sm">
            <Link href="/account/security">{t("account.securityLink")}</Link>
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground text-sm">{t("account.name")}</dt>
            <dd>{session.user.name}</dd>
            <dt className="text-muted-foreground text-sm">{t("account.email")}</dt>
            <dd>{session.user.email}</dd>
            <dt className="text-muted-foreground text-sm">{t("account.roles")}</dt>
            <dd className="flex flex-wrap gap-2">
              {session.memberships.length === 0 ? <span>{t("account.noRoles")}</span> : null}
              {session.memberships.map((m) => (
                <Badge key={`${m.organizationId}-${m.role}`} variant="secondary">
                  {t(`roles.${m.role}`)}, {m.organizationName}
                </Badge>
              ))}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.password.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/account/security">{t("account.securityLink")}</Link>
        </Button>
        {ready ? (
          <Button asChild>
            <Link href="/assessments">{t("account.continue")}</Link>
          </Button>
        ) : null}
      </div>
    </>
  );
}
