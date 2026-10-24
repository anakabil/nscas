"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmTotpAction, regenerateBackupCodesAction } from "../actions";

function BackupCodes({ codes }: { codes: string[] }) {
  const t = useTranslations("security");
  return (
    <div className="space-y-3" data-testid="backup-codes">
      <h3 className="font-semibold">{t("backupTitle")}</h3>
      <p className="text-muted-foreground text-sm">{t("backupIntro")}</p>
      <ol className="bg-surface-alt grid grid-cols-2 gap-2 rounded-xl p-4 font-mono text-base tabular-nums">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
    </div>
  );
}

function CodeField({ id }: { id: string }) {
  const t = useTranslations("security");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("code")}</Label>
      <Input
        id={id}
        name="code"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="one-time-code"
        required
        className="max-w-40 font-mono tracking-widest tabular-nums"
      />
    </div>
  );
}

function errorText(state: ActionState, t: ReturnType<typeof useTranslations>) {
  return state.error ? <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert> : null;
}

export function EnableTotpForm() {
  const t = useTranslations("security");
  const [state, formAction] = useActionState(confirmTotpAction, initialActionState);

  if (state.success && state.secrets) {
    return (
      <div className="space-y-5">
        <Alert variant="success">{t("successEnabled")}</Alert>
        <BackupCodes codes={state.secrets} />
        <Button asChild>
          {/* Navigasi halaman penuh: cache rute di peramban dapat masih menyimpan pengalihan ke /account
              dari saat penyiapan belum selesai (hanya terlihat di build produksi). */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/assessments">{t("continue")}</a>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errorText(state, t)}
      <CodeField id="enable-code" />
      <SubmitButton pendingLabel={t("pending")}>{t("submit")}</SubmitButton>
    </form>
  );
}

export function RegenerateBackupCodesForm() {
  const t = useTranslations("security");
  const [state, formAction] = useActionState(regenerateBackupCodesAction, initialActionState);

  if (state.success && state.secrets) {
    return (
      <div className="space-y-5">
        <Alert variant="success">{t("successRegenerated")}</Alert>
        <BackupCodes codes={state.secrets} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <p className="text-muted-foreground text-sm">{t("regenerateIntro")}</p>
      {errorText(state, t)}
      <CodeField id="regenerate-code" />
      <SubmitButton variant="outline" pendingLabel={t("pending")}>
        {t("regenerate")}
      </SubmitButton>
    </form>
  );
}
