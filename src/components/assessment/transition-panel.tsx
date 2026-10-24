"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { transitionAction } from "@/app/(console)/assessments/[id]/setup/actions";
import { initialActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";

export interface TransitionView {
  to: string;
  label: string;
  conditions: { code: string; label: string; met: boolean }[];
  allowed: boolean;
  canAct: boolean;
  actorLabel: string;
  warning?: string;
}

export function TransitionPanel({ assessmentId, transition }: { assessmentId: string; transition: TransitionView }) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(transitionAction.bind(null, assessmentId, transition.to), initialActionState);

  return (
    <form action={formAction} className="space-y-4" data-testid={`transition-${transition.to}`}>
      {transition.conditions.length > 0 ? (
        <ul className="space-y-2">
          {transition.conditions.map((c) => (
            <li key={c.code} className="flex items-start gap-2 text-sm" data-met={c.met}>
              {c.met ? (
                <CheckCircle2 aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
              ) : (
                <Circle aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              )}
              <span className={c.met ? "" : "text-muted-foreground"}>{c.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {transition.warning ? <Alert variant="warning">{transition.warning}</Alert> : null}
      {state.error ? (
        <Alert variant="destructive">
          {t(`errors.${state.error}`)}
          {state.details?.length ? (
            <ul className="mt-2 list-disc pl-5">
              {state.details.map((code) => (
                <li key={code}>{t(`conditions.${code}`)}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state.success ? <Alert variant="success">{t("overview.transitioned")}</Alert> : null}
      {transition.canAct ? (
        <SubmitButton pendingLabel={t("saving")} variant={transition.allowed ? "default" : "outline"}>
          {transition.label}
        </SubmitButton>
      ) : (
        <p className="text-muted-foreground text-sm">{t("overview.onlyRoles", { role: transition.actorLabel })}</p>
      )}
    </form>
  );
}
