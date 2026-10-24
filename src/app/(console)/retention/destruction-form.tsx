"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/components/forms/action-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destroyRawDataAction } from "./actions";

const FIELDS = ["clientConfirmationRef", "clientConfirmedOn", "clientConfirmedBy", "witnessName"] as const;
const LABELS: Record<(typeof FIELDS)[number], "ref" | "date" | "by" | "witness"> = {
  clientConfirmationRef: "ref",
  clientConfirmedOn: "date",
  clientConfirmedBy: "by",
  witnessName: "witness",
};

export function DestructionForm({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("retention.form");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [values, setValues] = useState<Record<(typeof FIELDS)[number] | "notes", string>>({ clientConfirmationRef: "", clientConfirmedOn: "", clientConfirmedBy: "", witnessName: "", notes: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <div className="bg-tint space-y-3 rounded-lg p-4" data-testid="destruction-form">
      <h3 className="font-semibold">{t("title")}</h3>
      <p className="text-muted-foreground text-sm">{t("scope")}</p>
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("done")}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f} className="space-y-1">
            <Label htmlFor={`${f}-${assessmentId}`}>{t(LABELS[f])}</Label>
            <Input id={`${f}-${assessmentId}`} type={f === "clientConfirmedOn" ? "date" : "text"} value={values[f]} onChange={set(f)} maxLength={200} />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`notes-${assessmentId}`}>{t("notes")}</Label>
        <textarea id={`notes-${assessmentId}`} className="border-input w-full rounded-md border bg-white px-3 py-2 text-sm" rows={2} maxLength={2000} value={values.notes} onChange={set("notes")} />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {t("confirm")}
      </label>
      <Button
        type="button"
        variant="destructive"
        disabled={pending || !confirmed}
        onClick={() =>
          startTransition(async () => {
            const result = await destroyRawDataAction(assessmentId, { ...values, confirmed });
            setState(result);
            if (result.success) router.refresh();
          })
        }
      >
        {t("submit")}
      </Button>
    </div>
  );
}
