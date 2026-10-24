"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DetailsValues {
  name: string;
  scopeType: string;
  periodStart: string;
  periodEnd: string;
  targetLevel: number;
  instrumentVersionId: string;
}

export function AssessmentDetailsForm({
  action,
  values,
  organizations,
  instrumentVersions,
  editable,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: DetailsValues;
  organizations?: { id: string; name: string }[];
  instrumentVersions: { id: string; code: string }[];
  editable: boolean;
  submitLabel: string;
}) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("saved")}</Alert> : null}
      <fieldset disabled={!editable} className="grid gap-5 sm:grid-cols-2">
        {organizations ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="organizationId">{t("fields.organization")}</Label>
            <Select id="organizationId" name="organizationId" required>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">{t("fields.name")}</Label>
          <Input id="name" name="name" defaultValue={values?.name} required minLength={3} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scopeType">{t("fields.scopeType")}</Label>
          <Select id="scopeType" name="scopeType" defaultValue={values?.scopeType ?? "CORPORATE"}>
            {(["CORPORATE", "DIVISION", "PROJECT"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`scopes.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetLevel">{t("fields.targetLevel")}</Label>
          <Select id="targetLevel" name="targetLevel" defaultValue={String(values?.targetLevel ?? 4)}>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                {t(`levels.${l}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodStart">{t("fields.periodStart")}</Label>
          <Input id="periodStart" name="periodStart" type="date" defaultValue={values?.periodStart} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">{t("fields.periodEnd")}</Label>
          <Input id="periodEnd" name="periodEnd" type="date" defaultValue={values?.periodEnd} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="instrumentVersionId">{t("fields.instrumentVersion")}</Label>
          <Select id="instrumentVersionId" name="instrumentVersionId" defaultValue={values?.instrumentVersionId}>
            {instrumentVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code}
              </option>
            ))}
          </Select>
        </div>
      </fieldset>
      {editable ? <SubmitButton pendingLabel={t("saving")}>{submitLabel}</SubmitButton> : null}
    </form>
  );
}
