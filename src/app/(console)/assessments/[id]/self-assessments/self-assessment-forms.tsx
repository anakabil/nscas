"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { issueSelfAssessmentAction, reissueSelfAssessmentAction, revokeSelfAssessmentAction, type IssueState } from "./actions";

function LinkOnce({ link }: { link: string }) {
  const t = useTranslations("selfAssessments.issue");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-tint max-w-full rounded px-2 py-1 text-xs break-all" data-testid="sa-link">
        {link}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}

export function IssueSelfAssessmentForm({ assessmentId, units }: { assessmentId: string; units: { id: string; name: string }[] }) {
  const t = useTranslations("selfAssessments.issue");
  const tErrors = useTranslations("assessment.errors");
  const [state, formAction] = useActionState<IssueState, FormData>(issueSelfAssessmentAction.bind(null, assessmentId), {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.link ? (
        <Alert variant="warning" className="space-y-2">
          <p>{t("issued", { name: state.name ?? "" })}</p>
          <LinkOnce link={state.link} />
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sa-name">{t("name")}</Label>
          <Input id="sa-name" name="name" required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sa-position">{t("position")}</Label>
          <Input id="sa-position" name="position" required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sa-unit">{t("unit")}</Label>
          <Select id="sa-unit" name="unitId" required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <SubmitButton pendingLabel={t("pending")}>{t("submit")}</SubmitButton>
    </form>
  );
}

export function SelfAssessmentRowActions({ assessmentId, selfAssessmentId, revoked }: { assessmentId: string; selfAssessmentId: string; revoked: boolean }) {
  const t = useTranslations("selfAssessments.table");
  const tErrors = useTranslations("assessment.errors");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<IssueState>({});
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!revoked ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t("confirmRevoke"))) return;
              startTransition(async () => setState(await revokeSelfAssessmentAction(assessmentId, selfAssessmentId)));
            }}
          >
            {t("revoke")}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => setState(await reissueSelfAssessmentAction(assessmentId, selfAssessmentId)))}>
          {t("reissue")}
        </Button>
      </div>
      {state.error ? <p className="text-danger text-sm">{tErrors(state.error)}</p> : null}
      {state.success ? <p className="text-success text-sm">{t("revoked")}</p> : null}
      {state.link ? (
        <div className="space-y-1">
          <p className="text-sm">{t("newLink")}</p>
          <LinkOnce link={state.link} />
        </div>
      ) : null}
    </div>
  );
}
