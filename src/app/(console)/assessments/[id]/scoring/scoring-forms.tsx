"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/components/forms/action-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runScoringAction, saveEvidenceRatingAction, saveSclAspectAction } from "./actions";

const LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const decimal = (n: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

interface EvidenceOption {
  id: string;
  title: string;
  mimeType: string;
  version: number;
  unitName: string | null;
  requirements: string[];
  href: string;
}

interface ObservationOption {
  id: string;
  itemLabel: string;
  windowTitle: string;
  unitName: string;
  capturedAt: string;
  outsideRadius: boolean;
  href: string;
}

function toggle(list: string[], id: string, on: boolean): string[] {
  return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
}

export function EvidenceRatingForm({
  assessmentId,
  code,
  open,
  rationaleMin,
  initial,
  evidence,
  observations,
}: {
  assessmentId: string;
  code: string;
  open: boolean;
  rationaleMin: number;
  initial: { level: number | null; rationale: string; evidenceIds: string[]; observationIds: string[] };
  evidence: EvidenceOption[];
  observations: ObservationOption[];
}) {
  const t = useTranslations("scoring.workspace");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [level, setLevel] = useState(initial.level === null ? "" : String(initial.level));
  const [rationale, setRationale] = useState(initial.rationale);
  const [evidenceIds, setEvidenceIds] = useState(initial.evidenceIds);
  const [observationIds, setObservationIds] = useState(initial.observationIds);
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await saveEvidenceRatingAction(assessmentId, code, { level, rationale, evidenceIds, observationIds });
      setState(result);
      if (result.success) router.refresh();
    });

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="evidence-heading">
        <h3 id="evidence-heading" className="font-semibold">
          {t("evidence")}
        </h3>
        {evidence.length === 0 ? <p className="text-muted-foreground text-sm">{t("noEvidence")}</p> : null}
        <ul className="space-y-2">
          {evidence.map((e) => (
            <li key={e.id} className="border-border rounded-lg border p-3 text-sm" data-testid="rating-evidence">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{e.title}</span>
                <Badge variant="outline">{t("version", { version: e.version })}</Badge>
                {e.unitName ? <span className="text-muted-foreground">{e.unitName}</span> : null}
                <a href={e.href} className="text-brand-navy underline" target="_blank" rel="noopener noreferrer">
                  {t("open")}
                </a>
              </div>
              {e.requirements.length ? <p className="text-muted-foreground">{t("requirements", { list: e.requirements.join("; ") })}</p> : null}
              <label className="mt-1 flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5" checked={evidenceIds.includes(e.id)} onChange={(ev) => setEvidenceIds((l) => toggle(l, e.id, ev.target.checked))} disabled={!open} />
                {t("basis")}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" aria-labelledby="observation-heading">
        <h3 id="observation-heading" className="font-semibold">
          {t("observations")}
        </h3>
        <p className="text-muted-foreground text-sm">{t("observationsIntro")}</p>
        {observations.length === 0 ? <p className="text-muted-foreground text-sm">{t("noObservations")}</p> : null}
        <ul className="space-y-2">
          {observations.map((o) => (
            <li key={o.id} className="border-border rounded-lg border p-3 text-sm" data-testid="rating-observation">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{o.itemLabel}</span>
                <span className="text-muted-foreground">
                  {o.windowTitle} · {o.unitName} · {o.capturedAt}
                </span>
                {o.outsideRadius ? <Badge variant="destructive">{t("outside")}</Badge> : null}
                <a href={o.href} className="text-brand-navy underline" target="_blank" rel="noopener noreferrer">
                  {t("open")}
                </a>
              </div>
              <label className="mt-1 flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5" checked={observationIds.includes(o.id)} onChange={(ev) => setObservationIds((l) => toggle(l, o.id, ev.target.checked))} disabled={!open} />
                {t("basis")}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="rating-heading">
        <h3 id="rating-heading" className="font-semibold">
          {t("form")}
        </h3>
        {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
        {state.success ? (
          <Alert variant="success" data-testid="rating-saved">
            {t("saved")}
          </Alert>
        ) : null}
        <div className="max-w-48 space-y-1">
          <Label htmlFor="rating-level">{t("level")}</Label>
          <Select id="rating-level" value={level} onChange={(e) => setLevel(e.target.value)} disabled={!open}>
            <option value="">{t("choose")}</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {decimal(l)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rating-rationale">{t("rationale")}</Label>
          <textarea
            id="rating-rationale"
            className="border-input bg-card min-h-28 w-full rounded-md border p-3 text-sm"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            disabled={!open}
            maxLength={4000}
            aria-describedby="rating-rationale-hint"
          />
          <p id="rating-rationale-hint" className="text-muted-foreground text-xs">
            {t("rationaleHint", { min: rationaleMin })}
          </p>
        </div>
        {open ? (
          <Button type="button" onClick={submit} disabled={pending || level === ""}>
            {t("save")}
          </Button>
        ) : (
          <Alert variant="info">{t("closed")}</Alert>
        )}
      </section>
    </div>
  );
}

export function SclAspectForm({
  assessmentId,
  aspect,
  entries,
  canEdit,
}: {
  assessmentId: string;
  aspect: { code: string; name: string; weightLabel: string };
  entries: { step: number; percent: number | null; justification: string; enteredBy: string | null }[];
  canEdit: boolean;
}) {
  const t = useTranslations("scoring.scl");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [values, setValues] = useState(entries.map((e) => ({ step: e.step, percent: e.percent === null ? "" : String(e.percent).replace(".", ","), justification: e.justification })));
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const set = (step: number, patch: Partial<{ percent: string; justification: string }>) => setValues((list) => list.map((v) => (v.step === step ? { ...v, ...patch } : v)));

  const submit = () =>
    startTransition(async () => {
      const result = await saveSclAspectAction(assessmentId, {
        aspectCode: aspect.code,
        entries: values.map((v) => ({ step: v.step, percent: v.percent.replace(",", ".").trim(), justification: v.justification })),
      });
      setState(result);
      if (result.success) router.refresh();
    });

  return (
    <div className="space-y-3" data-testid={`scl-${aspect.code}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-semibold">{t("aspect", { code: aspect.code, name: aspect.name })}</h3>
        <span className="text-muted-foreground text-sm">{t("weight", { weight: aspect.weightLabel })}</span>
      </div>
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("saved")}</Alert> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {values.map((v) => {
          const entry = entries.find((e) => e.step === v.step);
          return (
            <div key={v.step} className="border-border space-y-2 rounded-lg border p-3">
              <div className="space-y-1">
                <Label htmlFor={`scl-${aspect.code}-${v.step}`}>{t("percent", { step: v.step })}</Label>
                <Input id={`scl-${aspect.code}-${v.step}`} inputMode="decimal" className="max-w-32" value={v.percent} onChange={(e) => set(v.step, { percent: e.target.value })} readOnly={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`scl-${aspect.code}-${v.step}-why`}>{t("justification", { step: v.step })}</Label>
                <textarea
                  id={`scl-${aspect.code}-${v.step}-why`}
                  className="border-input bg-card min-h-20 w-full rounded-md border p-2 text-sm"
                  value={v.justification}
                  onChange={(e) => set(v.step, { justification: e.target.value })}
                  readOnly={!canEdit}
                  maxLength={2000}
                />
              </div>
              {entry?.enteredBy ? <p className="text-muted-foreground text-xs">{entry.enteredBy}</p> : null}
            </div>
          );
        })}
      </div>
      {canEdit ? (
        <Button type="button" onClick={submit} disabled={pending}>
          {t("save", { code: aspect.code })}
        </Button>
      ) : null}
    </div>
  );
}

export function RunEngineButton({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("scoring.run");
  const tErrors = useTranslations("assessment.errors");
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? (
        <Alert variant="success" data-testid="run-done">
          {t("done", { index: state.details?.[0] ?? "" })}
        </Alert>
      ) : null}
      <Button type="button" disabled={pending} onClick={() => startTransition(async () => setState(await runScoringAction(assessmentId)))}>
        {pending ? t("running") : t("button")}
      </Button>
    </div>
  );
}
