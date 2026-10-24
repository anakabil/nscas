import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countUnusedBackupCodes, getOrCreateTotpEnrollment } from "@/lib/auth/account";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { getAppTimeZone } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { EnableTotpForm, RegenerateBackupCodesForm } from "./totp-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("security");
  return { title: t("title") };
}

export default async function SecurityPage() {
  const session = await requireUser({ allowSetupPending: true });
  const t = await getTranslations("security");
  const user = await getDb().user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpEnabledAt: true },
  });

  if (user.totpEnabled) {
    const remaining = await countUnusedBackupCodes(session.user.id);
    return (
      <>
        <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
        <Card>
          <CardContent className="space-y-2">
            <p data-testid="totp-status">
              {t("enabled", { date: formatDate(user.totpEnabledAt ?? new Date(), getAppTimeZone()) })}
            </p>
            <p className="text-muted-foreground text-sm tabular-nums">{t("backupRemaining", { count: remaining })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("regenerateTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RegenerateBackupCodesForm />
          </CardContent>
        </Card>
      </>
    );
  }

  const enrollment = await getOrCreateTotpEnrollment(session);
  return (
    <>
      <h1 className="text-brand-navy text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("intro")}</p>
      <Card>
        <CardHeader>
          <CardTitle>{t("setupTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="list-decimal space-y-4 pl-5">
            <li>{t("step1")}</li>
            <li className="space-y-3">
              <span>{t("step2")}</span>
              {enrollment ? (
                <>
                  {/* Gambar data URI dibuat di server; tidak ada permintaan ke layanan luar. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qrDataUrl} alt={t("qrAlt")} width={220} height={220} className="rounded-lg border" />
                  <p className="text-muted-foreground text-sm">{t("manualKey")}</p>
                  <code data-testid="totp-secret" className="bg-surface-alt block break-all rounded-md px-3 py-2 font-mono text-sm">
                    {enrollment.secret}
                  </code>
                </>
              ) : null}
            </li>
            <li>{t("step3")}</li>
          </ol>
          <EnableTotpForm />
        </CardContent>
      </Card>
    </>
  );
}
