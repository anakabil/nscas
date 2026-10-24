"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { createUnitAction, deleteUnitAction, updateUnitAction } from "../actions";

export interface UnitValues {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
}

const UNIT_TYPES = ["HEAD_OFFICE", "DIVISION", "PROJECT", "BRANCH"] as const;

function decimalText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

function Feedback({ state }: { state: ActionState }) {
  const t = useTranslations("assessment");
  if (state.error) return <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert>;
  if (state.success) return <Alert variant="success">{t("saved")}</Alert>;
  return null;
}

function UnitFields({ idPrefix, values, parents }: { idPrefix: string; values?: UnitValues; parents: { id: string; label: string }[] }) {
  const t = useTranslations("assessment.units");
  const [type, setType] = useState(values?.type ?? "PROJECT");
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2 sm:col-span-3">
        <Label htmlFor={`${idPrefix}-name`}>{t("name")}</Label>
        <Input id={`${idPrefix}-name`} name="name" defaultValue={values?.name} required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-type`}>{t("type")}</Label>
        <Select id={`${idPrefix}-type`} name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {UNIT_TYPES.map((u) => (
            <option key={u} value={u}>
              {t(`types.${u}`)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-parent`}>{t("parent")}</Label>
        <Select id={`${idPrefix}-parent`} name="parentId" defaultValue={values?.parentId ?? ""}>
          <option value="">{t("noParent")}</option>
          {parents
            .filter((p) => p.id !== values?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </Select>
      </div>
      {type === "PROJECT" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-lat`}>{t("latitude")}</Label>
            <Input id={`${idPrefix}-lat`} name="latitude" inputMode="decimal" defaultValue={decimalText(values?.latitude)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-lng`}>{t("longitude")}</Label>
            <Input id={`${idPrefix}-lng`} name="longitude" inputMode="decimal" defaultValue={decimalText(values?.longitude)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-radius`}>{t("radius")}</Label>
            <Input id={`${idPrefix}-radius`} name="radiusMeters" inputMode="numeric" defaultValue={values?.radiusMeters ?? ""} />
          </div>
          <FieldHint className="sm:col-span-3">{t("coordinatesHint")}</FieldHint>
        </>
      ) : null}
    </div>
  );
}

export function CreateUnitForm({ assessmentId, parents }: { assessmentId: string; parents: { id: string; label: string }[] }) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(createUnitAction.bind(null, assessmentId), initialActionState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Feedback state={state} />
      <UnitFields idPrefix="new-unit" parents={parents} />
      <SubmitButton pendingLabel={t("saving")}>{t("units.add")}</SubmitButton>
    </form>
  );
}

export function EditUnitForm({ assessmentId, unit, parents }: { assessmentId: string; unit: UnitValues; parents: { id: string; label: string }[] }) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(updateUnitAction.bind(null, assessmentId, unit.id), initialActionState);
  const [deleteState, deleteAction] = useActionState(deleteUnitAction.bind(null, assessmentId, unit.id), initialActionState);
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" noValidate>
        <Feedback state={state} />
        <UnitFields idPrefix={`unit-${unit.id}`} values={unit} parents={parents} />
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </form>
      <form action={deleteAction} className="space-y-2">
        {deleteState.error ? <Alert variant="destructive">{t(`errors.${deleteState.error}`)}</Alert> : null}
        <SubmitButton variant="destructive" pendingLabel={t("saving")}>
          {t("units.delete")}
        </SubmitButton>
      </form>
    </div>
  );
}
