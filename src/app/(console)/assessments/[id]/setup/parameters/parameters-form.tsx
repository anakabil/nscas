"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import type { EditableParameters } from "@/lib/assessments/parameters";
import { updateParametersAction } from "../actions";

function text(value: number): string {
  return String(value).replace(".", ",");
}

function DecimalField({ name, label, value, hint }: { name: string; label: string; value: number; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={text(value)} inputMode="decimal" className="max-w-40 tabular-nums" />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

export function ParametersForm({
  assessmentId,
  parameters,
  consentTextId,
  consentTextEn,
  dpaSigned,
  editable,
}: {
  assessmentId: string;
  parameters: EditableParameters;
  consentTextId: string;
  consentTextEn: string;
  dpaSigned: boolean;
  editable: boolean;
}) {
  const t = useTranslations("assessment");
  const p = (key: string) => t(`parameters.${key}`);
  const [state, formAction] = useActionState(updateParametersAction.bind(null, assessmentId), initialActionState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Alert variant="destructive">{t(`errors.${state.error}`)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("saved")}</Alert> : null}
      <fieldset disabled={!editable} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{p("layerWeights")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <DecimalField name="layerWeights.perception" label={p("perception")} value={parameters.layerWeights.perception} />
              <DecimalField name="layerWeights.evidence" label={p("evidence")} value={parameters.layerWeights.evidence} />
              <DecimalField name="layerWeights.validation" label={p("validation")} value={parameters.layerWeights.validation} />
            </div>
            <FieldHint>{p("layerWeightsHint")}</FieldHint>
            <DecimalField
              name="selfAssessmentWeightInPerception"
              label={p("selfAssessmentWeight")}
              value={parameters.selfAssessmentWeightInPerception}
              hint={p("selfAssessmentHint")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p("thresholds")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DecimalField name="divergenceThreshold" label={p("divergenceThreshold")} value={parameters.divergenceThreshold} />
            <DecimalField name="assessorDisagreementFlag" label={p("assessorDisagreementFlag")} value={parameters.assessorDisagreementFlag} />
            <DecimalField name="consolidation.maxAspectBelowLevel" label={p("maxAspectBelowLevel")} value={parameters.consolidation.maxAspectBelowLevel} />
            <DecimalField
              name="consolidation.maxCharacteristicBelowLevel"
              label={p("maxCharacteristicBelowLevel")}
              value={parameters.consolidation.maxCharacteristicBelowLevel}
            />
            <DecimalField name="perceptionGapAttention" label={p("perceptionGapAttention")} value={parameters.perceptionGapAttention} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p("sclTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parameters.sclThresholds.map((row) => (
              <div key={row.step} className="grid items-end gap-4 sm:grid-cols-[6rem_1fr_1fr]">
                <p className="font-semibold">
                  {p("step")} {row.step}
                </p>
                <DecimalField name={`scl.${row.step}.minWeightedAverage`} label={p("minWeightedAverage")} value={row.minWeightedAverage} />
                <DecimalField name={`scl.${row.step}.minPerAspect`} label={p("minPerAspect")} value={row.minPerAspect} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p("quality")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <DecimalField name="quality.cronbachAlphaMin" label={p("cronbachAlphaMin")} value={parameters.quality.cronbachAlphaMin} />
            <DecimalField name="quality.rwgMin" label={p("rwgMin")} value={parameters.quality.rwgMin} />
            <DecimalField
              name="quality.minRespondentsPerReportCell"
              label={p("minRespondents")}
              value={parameters.quality.minRespondentsPerReportCell}
              hint={p("minRespondentsHint")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p("sampling")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <DecimalField name="sampling.z" label={p("z")} value={parameters.sampling.z} />
            <DecimalField name="sampling.marginOfError" label={p("marginOfError")} value={parameters.sampling.marginOfError} />
            <DecimalField name="sampling.proportion" label={p("proportion")} value={parameters.sampling.proportion} />
            <DecimalField name="sampling.minParticipationPerStratum" label={p("minParticipation")} value={parameters.sampling.minParticipationPerStratum} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p("consent")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="consentTextId">{p("consentId")}</Label>
              <textarea
                id="consentTextId"
                name="consentTextId"
                defaultValue={consentTextId}
                rows={6}
                className="border-input bg-card w-full rounded-md border px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consentTextEn">{p("consentEn")}</Label>
              <textarea
                id="consentTextEn"
                name="consentTextEn"
                defaultValue={consentTextEn}
                rows={6}
                className="border-input bg-card w-full rounded-md border px-3 py-2 text-base"
              />
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input type="checkbox" name="dpaSigned" defaultChecked={dpaSigned} className="size-5" />
              {p("dpaSigned")}
            </label>
          </CardContent>
        </Card>
      </fieldset>
      {editable ? (
        <div className="space-y-2">
          <FieldHint>{p("decimalHint")}</FieldHint>
          <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
