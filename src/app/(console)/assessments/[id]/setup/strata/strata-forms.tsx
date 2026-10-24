"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { createStratumAction, deleteStratumAction, updatePopulationsAction, updateStratumAction } from "../actions";

export interface StratumRow {
  id: string;
  code: string;
  name: string;
  group: string;
  population: number;
  isContractor: boolean;
}

const GROUPS = ["MANAGEMENT", "SUPERVISORY", "FIELD"] as const;

function Feedback({ state }: { state: ActionState }) {
  const t = useTranslations("assessment");
  if (state.error) return <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert>;
  if (state.success) return <Alert variant="success">{t("saved")}</Alert>;
  return null;
}

export function PopulationTable({ assessmentId, strata, editable }: { assessmentId: string; strata: StratumRow[]; editable: boolean }) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(updatePopulationsAction.bind(null, assessmentId), initialActionState);
  const total = strata.reduce((s, r) => s + r.population, 0);
  const format = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} />
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{t("strata.code")}</TableHeaderCell>
            <TableHeaderCell>{t("strata.name")}</TableHeaderCell>
            <TableHeaderCell>{t("strata.group")}</TableHeaderCell>
            <TableHeaderCell>{t("strata.contractor")}</TableHeaderCell>
            <TableHeaderCell className="text-right">{t("strata.population")}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          {strata.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono">{s.code}</TableCell>
              <TableCell>{s.name}</TableCell>
              <TableCell>{t(`strata.groups.${s.group}`)}</TableCell>
              <TableCell>{s.isContractor ? t("yes") : t("no")}</TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Input
                    aria-label={`${t("strata.population")} ${s.code}`}
                    name={`population:${s.id}`}
                    defaultValue={s.population}
                    inputMode="numeric"
                    className="ml-auto max-w-32 text-right tabular-nums"
                  />
                ) : (
                  <span className="tabular-nums">{format(s.population)}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={4} className="font-semibold">
              {t("strata.totalPopulation")}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums" data-testid="strata-total">
              {format(total)}
            </TableCell>
          </TableRow>
        </tbody>
      </Table>
      {editable ? <SubmitButton pendingLabel={t("saving")}>{t("strata.savePopulations")}</SubmitButton> : null}
    </form>
  );
}

function StratumFields({ idPrefix, values }: { idPrefix: string; values?: StratumRow }) {
  const t = useTranslations("assessment.strata");
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-code`}>{t("code")}</Label>
        <Input id={`${idPrefix}-code`} name="code" defaultValue={values?.code} required maxLength={20} className="font-mono uppercase" />
      </div>
      <div className="space-y-2 sm:col-span-3">
        <Label htmlFor={`${idPrefix}-name`}>{t("name")}</Label>
        <Input id={`${idPrefix}-name`} name="name" defaultValue={values?.name} required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-group`}>{t("group")}</Label>
        <Select id={`${idPrefix}-group`} name="group" defaultValue={values?.group ?? "FIELD"}>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {t(`groups.${g}`)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-population`}>{t("population")}</Label>
        <Input id={`${idPrefix}-population`} name="population" defaultValue={values?.population ?? 0} inputMode="numeric" />
      </div>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm sm:col-span-2">
        <input type="checkbox" name="isContractor" defaultChecked={values?.isContractor} className="size-5" />
        {t("contractor")}
      </label>
    </div>
  );
}

export function CreateStratumForm({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(createStratumAction.bind(null, assessmentId), initialActionState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Feedback state={state} />
      <StratumFields idPrefix="new-stratum" />
      <SubmitButton pendingLabel={t("saving")}>{t("strata.add")}</SubmitButton>
    </form>
  );
}

export function EditStratumForm({ assessmentId, stratum }: { assessmentId: string; stratum: StratumRow }) {
  const t = useTranslations("assessment");
  const [state, formAction] = useActionState(updateStratumAction.bind(null, assessmentId, stratum.id), initialActionState);
  const [deleteState, deleteAction] = useActionState(deleteStratumAction.bind(null, assessmentId, stratum.id), initialActionState);
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" noValidate>
        <Feedback state={state} />
        <StratumFields idPrefix={`stratum-${stratum.id}`} values={stratum} />
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </form>
      <form action={deleteAction} className="space-y-2">
        {deleteState.error ? <Alert variant="destructive">{t(`errors.${deleteState.error}`)}</Alert> : null}
        <SubmitButton variant="destructive" pendingLabel={t("saving")}>
          {t("strata.delete")}
        </SubmitButton>
      </form>
    </div>
  );
}
