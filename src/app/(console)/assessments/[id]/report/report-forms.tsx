"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/components/forms/action-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReportVersionAction, finalizeReportAction } from "./actions";

export function CreateVersionButton({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("report");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? (
        <Alert variant="success" data-testid="report-created">
          {t("created", { version: Number(state.details?.[0] ?? 0) })}
        </Alert>
      ) : null}
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createReportVersionAction(assessmentId);
            setState(result);
            if (result.success) router.refresh();
          })
        }
      >
        {t("create")}
      </Button>
    </div>
  );
}

export function FinalizeForm({ assessmentId, version }: { assessmentId: string; version: number }) {
  const t = useTranslations("report.finalize");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [position, setPosition] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3" data-testid="finalize-form">
      <p className="text-muted-foreground text-sm">{t("intro")}</p>
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? (
        <Alert variant="success" data-testid="report-finalized">
          {t("done", { version })}
        </Alert>
      ) : null}
      <div className="max-w-md space-y-1">
        <Label htmlFor={`position-${version}`}>{t("position")}</Label>
        <Input id={`position-${version}`} value={position} onChange={(e) => setPosition(e.target.value)} maxLength={200} />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {t("confirm")}
      </label>
      <Button
        type="button"
        disabled={pending || !confirmed}
        onClick={() =>
          startTransition(async () => {
            const result = await finalizeReportAction(assessmentId, { version, position, confirmed });
            setState(result);
            if (result.success) router.refresh();
          })
        }
      >
        {t("button", { version })}
      </Button>
    </div>
  );
}
