"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/components/forms/action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setExclusionAction } from "../actions";

export function ExclusionForm({ assessmentId, responseId, code, excluded }: { assessmentId: string; responseId: string; code: string; excluded: boolean }) {
  const t = useTranslations("dashboard.quality");
  const tErrors = useTranslations("assessment.errors");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex min-w-64 flex-col gap-2">
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reason")} aria-label={t("reasonFor", { code })} maxLength={1000} />
      <Button type="button" size="sm" variant={excluded ? "outline" : "default"} disabled={pending} onClick={() => startTransition(async () => setState(await setExclusionAction(assessmentId, { responseId, excluded: !excluded, reason })))}>
        {excluded ? t("restore") : t("exclude")}
      </Button>
      {state.error ? (
        <span role="alert" className="text-danger text-xs">
          {tErrors(state.error)}
        </span>
      ) : null}
      {state.success ? <span className="text-success text-xs">{state.success === "EXCLUDED" ? t("excludedDone") : t("restoredDone")}</span> : null}
    </div>
  );
}
