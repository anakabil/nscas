"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/components/forms/action-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { finalizePanelAction, removePanelAdjustmentAction, savePanelAdjustmentAction } from "./actions";

/** Isian terkendali agar tidak dikosongkan ketika penyimpanan ditolak (React mengatur ulang formulir setelah aksi). */
export function AdjustmentForm({ assessmentId, characteristics, rationaleMin }: { assessmentId: string; characteristics: { code: string; label: string }[]; rationaleMin: number }) {
  const t = useTranslations("panel.adjust");
  const tErrors = useTranslations("assessment.errors");
  const [code, setCode] = useState(characteristics[0]?.code ?? "");
  const [value, setValue] = useState("");
  const [rationale, setRationale] = useState("");
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const form = new FormData();
      form.set("characteristicCode", code);
      form.set("adjustedValue", value);
      form.set("rationale", rationale);
      const result = await savePanelAdjustmentAction(assessmentId, {}, form);
      setState(result);
      if (result.success) {
        setValue("");
        setRationale("");
      }
    });
  return (
    <div className="space-y-3" data-testid="adjustment-form">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? (
        <Alert variant="success" data-testid="adjustment-saved">
          {t("saved")}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="space-y-1">
          <Label htmlFor="adjust-code">{t("characteristic")}</Label>
          <Select id="adjust-code" value={code} onChange={(e) => setCode(e.target.value)}>
            {characteristics.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="adjust-value">{t("value")}</Label>
          <Input id="adjust-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="adjust-value-hint" />
          <p id="adjust-value-hint" className="text-muted-foreground text-xs">
            {t("valueHint")}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="adjust-rationale">{t("rationale")}</Label>
        <textarea
          id="adjust-rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          maxLength={4000}
          className="border-input bg-card min-h-24 w-full rounded-md border p-3 text-sm"
          aria-describedby="adjust-rationale-hint"
        />
        <p id="adjust-rationale-hint" className="text-muted-foreground text-xs">
          {t("rationaleHint", { min: rationaleMin })}
        </p>
      </div>
      <Button type="button" onClick={submit} disabled={pending || !value.trim()}>
        {t("save")}
      </Button>
    </div>
  );
}

export function RemoveAdjustmentButton({ assessmentId, code }: { assessmentId: string; code: string }) {
  const t = useTranslations("panel.adjust");
  const tErrors = useTranslations("assessment.errors");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});
  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => setState(await removePanelAdjustmentAction(assessmentId, code)))}>
        {t("remove", { code })}
      </Button>
      {state.error ? <span className="text-danger text-sm">{tErrors(state.error)}</span> : null}
    </>
  );
}

export function FinalizeForm({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("panel.finalize");
  const tErrors = useTranslations("assessment.errors");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});
  return (
    <div className="space-y-3">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? (
        <Alert variant="success" data-testid="finalized">
          {t("done")}
        </Alert>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {t("confirm")}
      </label>
      <Button type="button" disabled={!confirmed || pending} onClick={() => startTransition(async () => setState(await finalizePanelAction(assessmentId, confirmed)))}>
        {t("button")}
      </Button>
    </div>
  );
}
