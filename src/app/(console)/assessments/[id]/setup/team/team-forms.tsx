"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addAssignmentAction, removeAssignmentAction } from "../actions";

export function AddAssignmentForm({ assessmentId, staff }: { assessmentId: string; staff: { id: string; label: string }[] }) {
  const t = useTranslations();
  const [state, formAction] = useActionState(addAssignmentAction.bind(null, assessmentId), initialActionState);
  if (staff.length === 0) return <p className="text-muted-foreground text-sm">{t("assessment.team.noStaff")}</p>;
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="destructive">{t(`assessment.errors.${state.error}`)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("assessment.saved")}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="userId">{t("assessment.team.staff")}</Label>
          <Select id="userId" name="userId">
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">{t("assessment.team.role")}</Label>
          <Select id="role" name="role" defaultValue="ASSESSOR">
            <option value="ASSESSOR">{t("roles.ASSESSOR")}</option>
            <option value="LEAD_ASSESSOR">{t("roles.LEAD_ASSESSOR")}</option>
          </Select>
        </div>
      </div>
      <SubmitButton pendingLabel={t("assessment.saving")}>{t("assessment.team.add")}</SubmitButton>
    </form>
  );
}

export function RemoveAssignmentButton({ assessmentId, assignmentId }: { assessmentId: string; assignmentId: string }) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(removeAssignmentAction.bind(null, assessmentId, assignmentId), initialActionState);
  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert> : null}
      <SubmitButton variant="outline" pendingLabel={t("saving")}>
        {t("team.remove")}
      </SubmitButton>
    </form>
  );
}
