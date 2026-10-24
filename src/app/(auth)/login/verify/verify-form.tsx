"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { verifyAction } from "../actions";

export function VerifyForm() {
  const t = useTranslations("auth.verify");
  const [state, formAction] = useActionState(verifyAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="code">{t("code")}</Label>
        <Input
          id="code"
          name="code"
          autoComplete="one-time-code"
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          required
          autoFocus
          className="font-mono tracking-widest tabular-nums"
        />
        <FieldHint>{t("codeHint")}</FieldHint>
      </div>
      <SubmitButton pendingLabel={t("pending")} className="w-full">
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
