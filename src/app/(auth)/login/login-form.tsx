"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const [state, formAction] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton pendingLabel={t("pending")} className="w-full">
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
