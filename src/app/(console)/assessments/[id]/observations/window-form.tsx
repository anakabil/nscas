"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWindowAction } from "./actions";

const decimal = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export function CreateWindowForm({ assessmentId, units }: { assessmentId: string; units: { id: string; name: string; latitude: number | null; longitude: number | null; radiusMeters: number | null }[] }) {
  const t = useTranslations("observations.create");
  const tErrors = useTranslations("assessment.errors");
  const [state, formAction] = useActionState<ActionState, FormData>(createWindowAction.bind(null, assessmentId), initialActionState);
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const unit = units.find((u) => u.id === unitId);
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("created")}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ow-unit">{t("unit")}</Label>
          <Select id="ow-unit" name="unitId" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ow-title">{t("titleField")}</Label>
          <Input id="ow-title" name="title" required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ow-opens">{t("opensAt")}</Label>
          <Input id="ow-opens" name="opensAt" type="datetime-local" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ow-closes">{t("closesAt")}</Label>
          <Input id="ow-closes" name="closesAt" type="datetime-local" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ow-checklist">{t("checklist")}</Label>
        <textarea id="ow-checklist" name="checklist" className="border-input bg-card min-h-28 w-full rounded-md border p-3 text-sm" required aria-describedby="ow-checklist-hint" />
        <p id="ow-checklist-hint" className="text-muted-foreground text-xs">
          {t("checklistHint")}
        </p>
      </div>
      {/* key: koordinat terisi ulang dari unit yang dipilih */}
      <div key={unitId} className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ow-lat">{t("latitude")}</Label>
          <Input id="ow-lat" name="latitude" inputMode="decimal" defaultValue={decimal(unit?.latitude ?? null)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ow-lng">{t("longitude")}</Label>
          <Input id="ow-lng" name="longitude" inputMode="decimal" defaultValue={decimal(unit?.longitude ?? null)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ow-radius">{t("radius")}</Label>
          <Input id="ow-radius" name="radiusMeters" inputMode="numeric" defaultValue={unit?.radiusMeters ?? 500} required />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{t("coordinatesHint")}</p>
      <SubmitButton pendingLabel={t("submit")}>{t("submit")}</SubmitButton>
    </form>
  );
}

export function CopyLink({ path }: { path: string }) {
  const t = useTranslations("observations.windows");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-tint rounded px-2 py-1 text-xs break-all" data-testid="window-link">
        {path}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`);
          setCopied(true);
        }}
      >
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}
