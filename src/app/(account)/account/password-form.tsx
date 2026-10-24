"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { changePasswordAction } from "./actions";

export function PasswordForm() {
  const t = useTranslations("account.password");
  const [state, formAction] = useActionState(changePasswordAction, initialActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("success")}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="currentPassword">{t("current")}</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">{t("new")}</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
        <FieldHint>{t("hint")}</FieldHint>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirm")}</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
      </div>
      <SubmitButton pendingLabel={t("pending")}>{t("submit")}</SubmitButton>
    </form>
  );
}
