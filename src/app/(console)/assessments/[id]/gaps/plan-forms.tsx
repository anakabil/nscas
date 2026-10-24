"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/components/forms/action-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addProgressAction, generateGapListAction, publishActionPlanAction, saveActionAction, updateGapAnalysisAction, verifyActionAction } from "./actions";

// Formulir rencana aksi. Isian terkendali dan dikirim melalui transisi, agar tidak dikosongkan bila ditolak.

function useSubmit() {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const submit = (fn: () => Promise<ActionState>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      setState(result);
      if (result.success) {
        onSuccess?.();
        router.refresh();
      }
    });
  return { state, pending, submit };
}

function Feedback({ state, success, testId }: { state: ActionState; success: string; testId?: string }) {
  const tErrors = useTranslations("assessment.errors");
  const t = useTranslations("gaps");
  if (state.error)
    return (
      <Alert variant="destructive">
        {tErrors(state.error)}
        {state.error === "ACTION_PLAN_INCOMPLETE" && state.details?.length ? ` ${t("incomplete", { codes: state.details.join(", ") })}` : null}
      </Alert>
    );
  if (state.success)
    return (
      <Alert variant="success" data-testid={testId}>
        {success}
      </Alert>
    );
  return null;
}

export function GenerateButton({ assessmentId, regenerate }: { assessmentId: string; regenerate: boolean }) {
  const t = useTranslations("gaps");
  const { state, pending, submit } = useSubmit();
  return (
    <div className="space-y-2">
      <Feedback state={state} success={t("generated", { count: Number(state.details?.[0] ?? 0) })} testId="gaps-generated" />
      <Button type="button" variant={regenerate ? "outline" : "default"} disabled={pending} onClick={() => submit(() => generateGapListAction(assessmentId))}>
        {regenerate ? t("regenerate") : t("generate")}
      </Button>
    </div>
  );
}

export function PublishButton({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("gaps");
  const { state, pending, submit } = useSubmit();
  return (
    <div className="space-y-2">
      <Feedback state={state} success={t("publishedDone")} testId="plan-published" />
      <p className="text-muted-foreground text-sm">{t("publishIntro")}</p>
      <Button type="button" disabled={pending} onClick={() => submit(() => publishActionPlanAction(assessmentId))}>
        {t("publish")}
      </Button>
    </div>
  );
}

export function GapAnalysisForm({ assessmentId, gapId, initial }: { assessmentId: string; gapId: string; initial: { rootCause: string; priority: string } }) {
  const t = useTranslations("gaps");
  const [rootCause, setRootCause] = useState(initial.rootCause);
  const [priority, setPriority] = useState(initial.priority);
  const { state, pending, submit } = useSubmit();
  return (
    <div className="space-y-2">
      <Feedback state={state} success={t("analysis.saved")} testId="analysis-saved" />
      <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
        <div className="space-y-1">
          <Label htmlFor={`root-${gapId}`}>{t("analysis.rootCause")}</Label>
          <textarea id={`root-${gapId}`} className="border-input bg-card min-h-24 w-full rounded-md border p-3 text-sm" value={rootCause} onChange={(e) => setRootCause(e.target.value)} maxLength={4000} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`priority-${gapId}`}>{t("analysis.priority")}</Label>
          <Select id={`priority-${gapId}`} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">{t("analysis.none")}</option>
            {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`priorities.${p}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button type="button" variant="outline" disabled={pending} onClick={() => submit(() => updateGapAnalysisAction(assessmentId, gapId, { rootCause, priority }))}>
        {t("analysis.save")}
      </Button>
    </div>
  );
}

export interface ActionValues {
  title: string;
  description: string;
  ownerName: string;
  ownerPosition: string;
  ownerEmail: string;
  unitId: string;
  dueDate: string;
  successIndicator: string;
}

export const EMPTY_ACTION: ActionValues = { title: "", description: "", ownerName: "", ownerPosition: "", ownerEmail: "", unitId: "", dueDate: "", successIndicator: "" };

export function ActionForm({
  assessmentId,
  target,
  initial,
  units,
  allowOrganizationLevel,
}: {
  assessmentId: string;
  target: { gapId?: string; actionId?: string };
  initial: ActionValues;
  units: { id: string; name: string }[];
  allowOrganizationLevel: boolean;
}) {
  const t = useTranslations("gaps");
  const [values, setValues] = useState<ActionValues>(initial.unitId || allowOrganizationLevel ? initial : { ...initial, unitId: units[0]?.id ?? "" });
  const { state, pending, submit } = useSubmit();
  const prefix = target.actionId ?? `new-${target.gapId}`;
  const field = (key: keyof ActionValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`${prefix}-${key}`}>{label}</Label>
      <Input id={`${prefix}-${key}`} value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} {...props} />
    </div>
  );
  return (
    <div className="space-y-3" data-testid="action-form">
      <Feedback state={state} success={target.actionId ? t("actions.saved") : t("actions.created")} testId="action-saved" />
      {field("title", t("fields.title"), { maxLength: 300 })}
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-description`}>{t("fields.description")}</Label>
        <textarea id={`${prefix}-description`} className="border-input bg-card min-h-20 w-full rounded-md border p-3 text-sm" value={values.description} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} maxLength={4000} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {field("ownerName", t("fields.ownerName"), { maxLength: 200 })}
        {field("ownerPosition", t("fields.ownerPosition"), { maxLength: 200 })}
        {field("ownerEmail", t("fields.ownerEmail"), { type: "email", inputMode: "email", maxLength: 254 })}
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-unitId`}>{t("fields.unit")}</Label>
          <Select id={`${prefix}-unitId`} value={values.unitId} onChange={(e) => setValues((v) => ({ ...v, unitId: e.target.value }))}>
            {allowOrganizationLevel ? <option value="">{t("fields.noUnit")}</option> : null}
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        {field("dueDate", t("fields.dueDate"), { type: "date" })}
      </div>
      {field("successIndicator", t("fields.successIndicator"), { maxLength: 1000 })}
      <Button
        type="button"
        disabled={pending}
        onClick={() => submit(() => saveActionAction(assessmentId, target, values), () => (target.actionId ? undefined : setValues(EMPTY_ACTION)))}
      >
        {t("actions.create")}
      </Button>
    </div>
  );
}

export function ProgressForm({ assessmentId, actionId, current }: { assessmentId: string; actionId: string; current: { progress: number; status: string } }) {
  const t = useTranslations("gaps");
  const [note, setNote] = useState("");
  const [percent, setPercent] = useState(String(current.progress));
  const [status, setStatus] = useState(current.status === "PLANNED" ? "IN_PROGRESS" : current.status);
  const { state, pending, submit } = useSubmit();
  return (
    <div className="space-y-2" data-testid="progress-form">
      <Feedback state={state} success={t("progress.saved")} testId="progress-saved" />
      <div className="space-y-1">
        <Label htmlFor={`note-${actionId}`}>{t("progress.note")}</Label>
        <textarea id={`note-${actionId}`} className="border-input bg-card min-h-20 w-full rounded-md border p-3 text-sm" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`percent-${actionId}`}>{t("progress.percent")}</Label>
          <Input id={`percent-${actionId}`} type="number" min={0} max={100} step={5} value={percent} onChange={(e) => setPercent(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`status-${actionId}`}>{t("progress.status")}</Label>
          <Select id={`status-${actionId}`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {(["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button type="button" variant="outline" disabled={pending} onClick={() => submit(() => addProgressAction(assessmentId, actionId, { note, progressPercent: percent, status }), () => setNote(""))}>
        {t("progress.save")}
      </Button>
    </div>
  );
}

export function VerifyForm({ assessmentId, actionId }: { assessmentId: string; actionId: string }) {
  const t = useTranslations("gaps");
  const [note, setNote] = useState("");
  const { state, pending, submit } = useSubmit();
  return (
    <div className="space-y-2" data-testid="verify-form">
      <Feedback state={state} success={t("verify.done")} testId="verify-saved" />
      <div className="space-y-1">
        <Label htmlFor={`verify-${actionId}`}>{t("verify.note")}</Label>
        <textarea id={`verify-${actionId}`} className="border-input bg-card min-h-20 w-full rounded-md border p-3 text-sm" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => submit(() => verifyActionAction(assessmentId, actionId, { approve: true, note }))}>
          {t("verify.approve")}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => submit(() => verifyActionAction(assessmentId, actionId, { approve: false, note }))}>
          {t("verify.reject")}
        </Button>
      </div>
    </div>
  );
}
