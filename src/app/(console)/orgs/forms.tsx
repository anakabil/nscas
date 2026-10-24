"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { addUserAction, createOrganizationAction, manageUserAction } from "./actions";

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm">{label}</p>
      <code data-testid="one-time-secret" className="bg-surface-alt block rounded-md px-3 py-2 font-mono text-base">
        {value}
      </code>
    </div>
  );
}

export function CreateOrganizationForm() {
  const t = useTranslations("orgs");
  const [state, formAction] = useActionState(createOrganizationAction, initialActionState);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3" noValidate>
      {state.error ? <Alert variant="destructive" className="sm:col-span-3">{t(`errors.${state.error}`)}</Alert> : null}
      {state.success ? <Alert variant="success" className="sm:col-span-3">{t("created")}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="org-name">{t("name")}</Label>
        <Input id="org-name" name="name" required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="org-legal">{t("legalName")}</Label>
        <Input id="org-legal" name="legalName" required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="org-sector">{t("sector")}</Label>
        <Input id="org-sector" name="sector" />
      </div>
      <div className="sm:col-span-3">
        <SubmitButton pendingLabel={t("pending")}>{t("createSubmit")}</SubmitButton>
      </div>
    </form>
  );
}

export function AddUserForm({
  organizationId,
  roles,
  units,
}: {
  organizationId: string;
  roles: { value: string; label: string }[];
  units: { id: string; label: string }[];
}) {
  const t = useTranslations("users");
  const [state, formAction] = useActionState(addUserAction.bind(null, organizationId), initialActionState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <p className="text-muted-foreground text-sm">{t("addIntro")}</p>
      <Feedback state={state} successText={state.success === "ADDED_EXISTING" ? t("addedExisting") : t("added")} />
      {state.secrets?.[0] ? <Secret label={t("tempPassword")} value={state.secrets[0]} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="user-email">{t("email")}</Label>
          <Input id="user-email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-name">{t("name")}</Label>
          <Input id="user-name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-role">{t("role")}</Label>
          <Select id="user-role" name="role" defaultValue={roles[0]?.value}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {roles.some((r) => r.value === "UNIT_COORDINATOR") ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t("unitScope")}</legend>
          <FieldHint>{t("unitScopeHint")}</FieldHint>
          {units.length === 0 ? <p className="text-muted-foreground text-sm">{t("noUnits")}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {units.map((u) => (
              <label key={u.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="unitScope" value={u.id} className="size-5" />
                {u.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <SubmitButton pendingLabel={t("pending")}>{t("addSubmit")}</SubmitButton>
    </form>
  );
}

function Feedback({ state, successText }: { state: ActionState; successText: string }) {
  const t = useTranslations("users");
  if (state.error) return <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert>;
  if (state.success) return <Alert variant="success">{successText}</Alert>;
  return null;
}

export function ManageUserButton({
  organizationId,
  userId,
  intent,
  membershipId,
  label,
  variant = "outline",
}: {
  organizationId: string;
  userId: string;
  intent: "activate" | "deactivate" | "resetTotp" | "resetPassword" | "unlock" | "revokeRole";
  membershipId?: string;
  label: string;
  variant?: "outline" | "destructive";
}) {
  const t = useTranslations("users");
  const [state, formAction] = useActionState(manageUserAction.bind(null, organizationId, userId), initialActionState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="intent" value={intent} />
      {membershipId ? <input type="hidden" name="membershipId" value={membershipId} /> : null}
      <Feedback state={state} successText={t("detail.done")} />
      {state.secrets?.[0] ? <Secret label={t("tempPassword")} value={state.secrets[0]} /> : null}
      <SubmitButton variant={variant} pendingLabel={t("pending")}>
        {label}
      </SubmitButton>
    </form>
  );
}
