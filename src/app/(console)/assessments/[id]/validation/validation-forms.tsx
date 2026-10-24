"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import {
  addParticipantAction,
  createSessionAction,
  createSessionsFromProposalAction,
  removeParticipantAction,
  saveAssessorFormAction,
  updateGuideAction,
  updateSessionAction,
} from "./actions";

const LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const decimal = (n: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

function Feedback({ state, success }: { state: ActionState; success: string }) {
  const tErrors = useTranslations("assessment.errors");
  if (state.error) return <Alert variant="destructive">{tErrors(state.error)}</Alert>;
  if (state.success) return <Alert variant="success">{success}</Alert>;
  return null;
}

/** Tetap terpasang setelah sesi dibuat, agar pesan berhasil tidak hilang ketika halaman dimuat ulang. */
export function CreateFromProposalButton({ assessmentId, exists }: { assessmentId: string; exists: boolean }) {
  const t = useTranslations("validation.proposal");
  const tErrors = useTranslations("assessment.errors");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});
  if (state.success) {
    return (
      <Alert variant="success" data-testid="proposal-created">
        {t("created", { count: Number(state.details?.[0] ?? 0) })}
      </Alert>
    );
  }
  if (exists) return <p className="text-muted-foreground text-sm">{t("exists")}</p>;
  return (
    <div className="space-y-2">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      <Button type="button" disabled={pending} onClick={() => startTransition(async () => setState(await createSessionsFromProposalAction(assessmentId)))}>
        {pending ? t("creating") : t("create")}
      </Button>
    </div>
  );
}

export interface SessionFormValues {
  type: string;
  label: string;
  unitId: string;
  stratumId: string;
  scheduledAt: string;
  meetingUrl: string;
  participantCount: string;
  guideLayer: string;
  status: string;
}

export function SessionForm({
  assessmentId,
  sessionId,
  values,
  units,
  strata,
}: {
  assessmentId: string;
  sessionId?: string;
  values: SessionFormValues;
  units: { id: string; name: string }[];
  strata: { id: string; code: string; name: string }[];
}) {
  const t = useTranslations("validation");
  const action = sessionId ? updateSessionAction.bind(null, assessmentId, sessionId) : createSessionAction.bind(null, assessmentId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, initialActionState);
  const id = (name: string) => `${sessionId ?? "new"}-${name}`;
  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} success={sessionId ? t("session.scheduleSaved") : t("create.created")} />
      <div className="grid gap-4 sm:grid-cols-2">
        {sessionId ? (
          <input type="hidden" name="type" value={values.type} />
        ) : (
          <div className="space-y-2">
            <Label htmlFor={id("type")}>{t("fields.type")}</Label>
            <Select id={id("type")} name="type" defaultValue={values.type}>
              {(["INTERVIEW", "FOCUS_GROUP", "VIRTUAL_SITE_VISIT"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`types.${v}`)}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor={id("label")}>{t("fields.label")}</Label>
          <Input id={id("label")} name="label" defaultValue={values.label} required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("scheduledAt")}>{t("fields.scheduledAt")}</Label>
          <Input id={id("scheduledAt")} name="scheduledAt" type="datetime-local" defaultValue={values.scheduledAt} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("meetingUrl")}>{t("fields.meetingUrl")}</Label>
          <Input id={id("meetingUrl")} name="meetingUrl" type="url" inputMode="url" defaultValue={values.meetingUrl} placeholder="https://" aria-describedby={id("meetingUrl-hint")} />
          <p id={id("meetingUrl-hint")} className="text-muted-foreground text-xs">
            {t("fields.meetingUrlHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("unitId")}>{t("fields.unit")}</Label>
          <Select id={id("unitId")} name="unitId" defaultValue={values.unitId}>
            <option value="">{t("fields.none")}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("stratumId")}>{t("fields.stratum")}</Label>
          <Select id={id("stratumId")} name="stratumId" defaultValue={values.stratumId}>
            <option value="">{t("fields.none")}</option>
            {strata.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("participantCount")}>{t("fields.participantCount")}</Label>
          <Input id={id("participantCount")} name="participantCount" inputMode="numeric" defaultValue={values.participantCount} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("guideLayer")}>{t("fields.guideLayer")}</Label>
          <Select id={id("guideLayer")} name="guideLayer" defaultValue={values.guideLayer}>
            {(["MANAGEMENT", "SUPERVISORY", "FIELD"] as const).map((l) => (
              <option key={l} value={l}>
                {t(`layers.${l}`)}
              </option>
            ))}
          </Select>
        </div>
        {sessionId ? (
          <div className="space-y-2">
            <Label htmlFor={id("status")}>{t("fields.status")}</Label>
            <Select id={id("status")} name="status" defaultValue={values.status}>
              {(["SCHEDULED", "COMPLETED", "CANCELLED"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
      <SubmitButton pendingLabel={sessionId ? t("session.saveSchedule") : t("create.submit")}>{sessionId ? t("session.saveSchedule") : t("create.submit")}</SubmitButton>
    </form>
  );
}

export function AssessorForm({
  assessmentId,
  sessionId,
  characteristics,
  initial,
  open,
}: {
  assessmentId: string;
  sessionId: string;
  characteristics: { id: string; code: string; name: string }[];
  initial: { recordingConsent: boolean; notes: string; ratings: Record<string, { level: number; note: string }> };
  open: boolean;
}) {
  const t = useTranslations("validation.session");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [recordingConsent, setRecordingConsent] = useState(initial.recordingConsent);
  const [notes, setNotes] = useState(initial.notes);
  const [ratings, setRatings] = useState(initial.ratings);
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await saveAssessorFormAction(assessmentId, sessionId, {
        recordingConsent,
        notes,
        ratings: characteristics.map((c) => ({ characteristicId: c.id, level: ratings[c.id]?.level ?? null, note: ratings[c.id]?.note ?? "" })),
      });
      setState(result);
      if (result.success) router.refresh();
    });

  return (
    <div className="space-y-4">
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? (
        <Alert variant="success" data-testid="assessor-form-saved">
          {t("formSaved")}
        </Alert>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-5" checked={recordingConsent} onChange={(e) => setRecordingConsent(e.target.checked)} disabled={!open} />
        {t("recordingConsent")}
      </label>
      <div className="space-y-1">
        <Label htmlFor="session-notes">{t("notes")}</Label>
        <textarea id="session-notes" className="border-input bg-card min-h-28 w-full rounded-md border p-3 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!open} maxLength={10_000} />
        <p className="text-warning text-xs">{t("notesHint")}</p>
      </div>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{t("form")}</TableHeaderCell>
            <TableHeaderCell className="w-40">{t("level")}</TableHeaderCell>
            <TableHeaderCell>{t("ratingNote")}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          {characteristics.map((c) => {
            const value = ratings[c.id];
            return (
              <TableRow key={c.id} data-testid="rating-row" data-code={c.code}>
                <TableCell>
                  <span className="font-mono">{c.code}</span> {c.name}
                </TableCell>
                <TableCell>
                  <Select
                    aria-label={`${t("level")} ${c.code}`}
                    value={value ? String(value.level) : ""}
                    disabled={!open}
                    onChange={(e) =>
                      setRatings((r) => {
                        const next = { ...r };
                        if (e.target.value === "") delete next[c.id];
                        else next[c.id] = { level: Number(e.target.value), note: r[c.id]?.note ?? "" };
                        return next;
                      })
                    }
                  >
                    <option value="">{t("notDiscussed")}</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {decimal(l)}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${t("ratingNote")} ${c.code}`}
                    value={value?.note ?? ""}
                    disabled={!open || !value}
                    maxLength={4000}
                    onChange={(e) => setRatings((r) => ({ ...r, [c.id]: { level: r[c.id]?.level ?? 3, note: e.target.value } }))}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </tbody>
      </Table>
      {open ? (
        <Button type="button" onClick={submit} disabled={pending}>
          {t("saveForm")}
        </Button>
      ) : (
        <Alert variant="info">{t("ratingsClosed")}</Alert>
      )}
    </div>
  );
}

export function ParticipantForm({ assessmentId, sessionId }: { assessmentId: string; sessionId: string }) {
  const t = useTranslations("validation.session");
  const [state, formAction] = useActionState<ActionState, FormData>(addParticipantAction.bind(null, assessmentId, sessionId), initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Feedback state={state} success="" /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="p-name">{t("fullName")}</Label>
          <Input id="p-name" name="fullName" required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-position">{t("position")}</Label>
          <Input id="p-position" name="position" required minLength={2} maxLength={200} />
        </div>
      </div>
      <SubmitButton pendingLabel={t("addParticipant")} variant="outline">
        {t("addParticipant")}
      </SubmitButton>
    </form>
  );
}

export function RemoveParticipantButton({ assessmentId, participantId }: { assessmentId: string; participantId: string }) {
  const t = useTranslations("validation.session");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removeParticipantAction(assessmentId, participantId);
          router.refresh();
        })
      }
    >
      {t("remove")}
    </Button>
  );
}

export function GuideEditor({
  assessmentId,
  layer,
  layerLabel,
  intro: initialIntro,
  questions: initialQuestions,
  names,
  canEdit,
}: {
  assessmentId: string;
  layer: "MANAGEMENT" | "SUPERVISORY" | "FIELD";
  layerLabel: string;
  intro: string;
  questions: { characteristicCode: string; question: string }[];
  names: Record<string, string>;
  canEdit: boolean;
}) {
  const t = useTranslations("validation.guides");
  const tErrors = useTranslations("assessment.errors");
  const [intro, setIntro] = useState(initialIntro);
  const [questions, setQuestions] = useState(initialQuestions);
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4" data-testid={`guide-${layer}`}>
      {state.error ? <Alert variant="destructive">{tErrors(state.error)}</Alert> : null}
      {state.success ? <Alert variant="success">{t("saved")}</Alert> : null}
      <div className="space-y-1">
        <Label htmlFor={`intro-${layer}`}>{t("introField")}</Label>
        <textarea id={`intro-${layer}`} className="border-input bg-card min-h-24 w-full rounded-md border p-3 text-sm" value={intro} onChange={(e) => setIntro(e.target.value)} readOnly={!canEdit} />
      </div>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={q.characteristicCode} className="space-y-1">
            <Label htmlFor={`q-${layer}-${q.characteristicCode}`}>
              <span className="font-mono">{q.characteristicCode}</span> {names[q.characteristicCode]}
            </Label>
            <textarea
              id={`q-${layer}-${q.characteristicCode}`}
              className="border-input bg-card min-h-16 w-full rounded-md border p-2 text-sm"
              value={q.question}
              readOnly={!canEdit}
              maxLength={1000}
              onChange={(e) => setQuestions((list) => list.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
            />
          </li>
        ))}
      </ol>
      {canEdit ? (
        <Button type="button" disabled={pending} onClick={() => startTransition(async () => setState(await updateGuideAction(assessmentId, { layer, intro, questions })))}>
          {t("save", { layer: layerLabel })}
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">{t("readOnly")}</p>
      )}
    </div>
  );
}
