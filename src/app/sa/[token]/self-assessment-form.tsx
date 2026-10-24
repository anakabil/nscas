"use client";

import { useEffect, useState } from "react";
import { NextIntlClientProvider, useTranslations, type AbstractIntlMessages } from "next-intl";

// Formulir penilaian mandiri: satu karakteristik per layar, draf disimpan ke server setiap kali berpindah
// layar, lalu dikirim sekali setelah semua karakteristik lengkap (docs/01 M4).

interface Characteristic {
  id: string;
  code: string;
  name: string;
  statements: { id: string; text: string }[];
  answer: { statementId: string | null; justification: string; evidenceIds: string[] };
}

interface Props {
  token: string;
  locale: "id" | "en";
  messages: AbstractIntlMessages;
  minLength: number;
  organizationName: string;
  profile: { name: string; position: string };
  evidence: { id: string; title: string; version: number; characteristicIds: string[] }[];
  characteristics: Characteristic[];
}

export function SelfAssessmentForm(props: Props) {
  return (
    <NextIntlClientProvider locale={props.locale} messages={{ selfAssessmentForm: props.messages }} timeZone="Asia/Jakarta">
      <Form {...props} />
    </NextIntlClientProvider>
  );
}

type Answer = Characteristic["answer"];
const length = (text: string) => text.trim().replace(/\s+/g, " ").length;

async function call(url: string, method: "PUT" | "POST", body?: unknown): Promise<{ ok: boolean; error?: string; missing?: { characteristicId: string; reasons: string[] }[] }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => ({}))) as { error?: string; missing?: { characteristicId: string; reasons: string[] }[] };
    return { ok: false, error: json.error ?? "INVALID_INPUT", missing: json.missing };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

function Form({ token, minLength, organizationName, profile: initialProfile, evidence, characteristics }: Props) {
  const t = useTranslations("selfAssessmentForm");
  const total = characteristics.length;
  // -1: halaman pembuka; 0..total-1: karakteristik; total: pemeriksaan akhir.
  const [index, setIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(characteristics.map((c) => [c.id, c.answer])));
  const [saved, setSaved] = useState<Record<string, Answer>>(answers);
  const [profile, setProfile] = useState(initialProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverMissing, setServerMissing] = useState<{ characteristicId: string; reasons: string[] }[] | null>(null);

  const current = index >= 0 && index < total ? (characteristics[index] as Characteristic) : null;
  const dirty = current !== null && JSON.stringify(answers[current.id]) !== JSON.stringify(saved[current.id]);

  // Peringatan peramban bila halaman ditutup sebelum isian layar ini tersimpan.
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  const persist = async (): Promise<boolean> => {
    if (!current) return true;
    const answer = answers[current.id] as Answer;
    if (JSON.stringify(answer) === JSON.stringify(saved[current.id])) return true;
    setBusy(true);
    const result = await call(`/sa/${token}/answer`, "PUT", { characteristicId: current.id, ...answer });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "INVALID_INPUT");
      return false;
    }
    setSaved((s) => ({ ...s, [current.id]: answer }));
    setNotice(t("nav.saved"));
    return true;
  };

  const goTo = async (next: number) => {
    setError(null);
    setNotice(null);
    if (!(await persist())) return;
    setIndex(next);
    window.scrollTo({ top: 0 });
  };

  const missing = characteristics
    .map((c) => {
      const a = answers[c.id] as Answer;
      const reasons = [...(a.statementId ? [] : ["LEVEL"]), ...(length(a.justification) >= minLength ? [] : ["JUSTIFICATION"])];
      return { characteristic: c, reasons };
    })
    .filter((m) => m.reasons.length > 0);
  const withoutEvidence = characteristics.filter((c) => (answers[c.id] as Answer).evidenceIds.length === 0).length;

  const update = (patch: Partial<Answer>) => {
    if (!current) return;
    setAnswers((s) => ({ ...s, [current.id]: { ...(s[current.id] as Answer), ...patch } }));
    setNotice(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <p className="text-muted-foreground text-sm font-semibold">{organizationName}</p>
      <h1 className="text-brand-navy mt-1 text-2xl leading-tight font-bold">{t("heading")}</h1>

      {error ? (
        <p role="alert" data-slot="alert" className="bg-heat-low text-danger mt-4 rounded-xl px-4 py-3 text-sm">
          {t(`errors.${error}`)}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-success mt-4 text-sm" data-testid="sa-notice">
          {notice}
        </p>
      ) : null}

      {index === -1 ? (
        <div className="mt-6 space-y-6">
          <section className="border-brand-navy bg-tint space-y-2 rounded-xl border-2 p-4" data-testid="sa-identified">
            <h2 className="text-brand-navy font-bold">{t("identified.title")}</h2>
            <p>{t("identified.body")}</p>
            <p className="text-sm">{t("identified.access")}</p>
          </section>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setBusy(true);
              const result = await call(`/sa/${token}/profile`, "PUT", profile);
              setBusy(false);
              if (result.ok) setNotice(t("profile.saved"));
              else setError(result.error ?? "INVALID_INPUT");
            }}
          >
            <h2 className="text-lg font-semibold">{t("profile.title")}</h2>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t("profile.name")}</span>
              <input className="border-input bg-card h-11 w-full rounded-md border px-3" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required minLength={2} maxLength={200} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t("profile.position")}</span>
              <input className="border-input bg-card h-11 w-full rounded-md border px-3" value={profile.position} onChange={(e) => setProfile({ ...profile, position: e.target.value })} required minLength={2} maxLength={200} />
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="survey-secondary" disabled={busy}>
                {t("profile.save")}
              </button>
              <button type="button" className="survey-primary" onClick={() => void goTo(0)} disabled={busy}>
                {t("start")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {current ? (
        <CharacteristicStep
          key={current.id}
          characteristic={current}
          position={index + 1}
          total={total}
          minLength={minLength}
          answer={answers[current.id] as Answer}
          evidence={evidence}
          onChange={update}
          onJump={(i) => void goTo(i)}
          characteristics={characteristics}
        />
      ) : null}

      {current ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="survey-secondary" onClick={() => void goTo(index - 1)} disabled={busy}>
            {t("nav.previous")}
          </button>
          <button type="button" className="survey-primary" onClick={() => void goTo(index + 1)} disabled={busy} data-testid="sa-next">
            {busy ? t("nav.saving") : index + 1 < total ? t("nav.saveNext") : t("nav.saveReview")}
          </button>
        </div>
      ) : null}

      {index === total ? (
        <section className="mt-6 space-y-4" data-testid="sa-review">
          <h2 className="text-xl font-semibold">{t("review.title")}</h2>
          {missing.length === 0 ? (
            <p className="text-success font-semibold">{t("review.complete")}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-danger font-semibold" data-testid="sa-missing" data-count={missing.length}>
                {t("review.incomplete", { count: missing.length })}
              </p>
              <ul className="space-y-1 text-sm">
                {missing.map((m) => (
                  <li key={m.characteristic.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{m.characteristic.code}</span>
                    <span>{m.characteristic.name}:</span>
                    <span>{m.reasons.map((r) => t(`review.reasons.${r}`, { min: minLength })).join(", ")}</span>
                    <button type="button" className="text-brand-navy underline" onClick={() => void goTo(characteristics.indexOf(m.characteristic))}>
                      {t("review.edit")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {withoutEvidence > 0 ? <p className="text-warning text-sm">{t("review.noEvidence", { count: withoutEvidence })}</p> : null}
          {serverMissing && serverMissing.length > 0 ? <p className="text-danger text-sm">{t("errors.INCOMPLETE")}</p> : null}
          <p className="text-sm">{t("review.warning")}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="survey-secondary" onClick={() => void goTo(total - 1)} disabled={busy}>
              {t("nav.previous")}
            </button>
            <button
              type="button"
              className="survey-primary"
              disabled={busy || missing.length > 0}
              data-testid="sa-submit"
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await call(`/sa/${token}/submit`, "POST");
                setBusy(false);
                if (result.ok) {
                  window.location.reload();
                  return;
                }
                setServerMissing(result.missing ?? null);
                setError(result.error ?? "INVALID_INPUT");
              }}
            >
              {busy ? t("review.submitting") : t("review.submit")}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CharacteristicStep({
  characteristic,
  characteristics,
  position,
  total,
  minLength,
  answer,
  evidence,
  onChange,
  onJump,
}: {
  characteristic: Characteristic;
  characteristics: Characteristic[];
  position: number;
  total: number;
  minLength: number;
  answer: Answer;
  evidence: Props["evidence"];
  onChange: (patch: Partial<Answer>) => void;
  onJump: (index: number) => void;
}) {
  const t = useTranslations("selfAssessmentForm");
  const linked = evidence.filter((e) => e.characteristicIds.includes(characteristic.id));
  const other = evidence.filter((e) => !e.characteristicIds.includes(characteristic.id));
  const count = length(answer.justification);
  const toggle = (evidenceId: string) =>
    onChange({ evidenceIds: answer.evidenceIds.includes(evidenceId) ? answer.evidenceIds.filter((x) => x !== evidenceId) : [...answer.evidenceIds, evidenceId] });

  const EvidenceList = ({ items }: { items: Props["evidence"] }) => (
    <ul className="space-y-2">
      {items.map((e) => (
        <li key={e.id}>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5" checked={answer.evidenceIds.includes(e.id)} onChange={() => toggle(e.id)} />
            <span>
              {e.title} <span className="text-muted-foreground text-sm">({t("characteristic.version", { version: e.version })})</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-6 space-y-6" data-testid="sa-characteristic" data-code={characteristic.code}>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{t("jump")}</span>
        <select className="border-input bg-card h-11 w-full rounded-md border px-3" value={position - 1} onChange={(e) => onJump(Number(e.target.value))}>
          {characteristics.map((c, i) => (
            <option key={c.id} value={i}>
              {c.code} {c.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-3">
        <legend className="mb-2 space-y-1">
          <span className="text-brand-navy block text-sm font-semibold" data-testid="sa-position">
            {t("characteristic.label", { current: position, total })}
          </span>
          <span className="block text-xl font-bold">
            {characteristic.code} {characteristic.name}
          </span>
          <span className="text-muted-foreground block">{t("characteristic.instruction")}</span>
        </legend>
        {characteristic.statements.map((s) => (
          <label key={s.id} className="survey-card block">
            <input type="radio" name={`s-${characteristic.id}`} className="sr-only" checked={answer.statementId === s.id} onChange={() => onChange({ statementId: s.id })} />
            {s.text}
          </label>
        ))}
      </fieldset>

      <label className="block space-y-2">
        <span className="font-semibold">{t("characteristic.justification")}</span>
        <span className="text-muted-foreground block text-sm">{t("characteristic.justificationHint", { min: minLength })}</span>
        <textarea
          className="border-input bg-card min-h-36 w-full rounded-md border p-3"
          value={answer.justification}
          maxLength={4000}
          onChange={(e) => onChange({ justification: e.target.value })}
          data-testid="sa-justification"
        />
        <span className={`block text-sm ${count >= minLength ? "text-success" : "text-muted-foreground"}`} data-testid="sa-counter">
          {t("characteristic.counter", { count, min: minLength })}
        </span>
      </label>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("characteristic.evidence")}</h3>
        {evidence.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("characteristic.noEvidenceUploaded")}</p>
        ) : (
          <>
            {linked.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{t("characteristic.evidenceLinked")}</p>
                <EvidenceList items={linked} />
              </div>
            ) : null}
            {other.length > 0 ? (
              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-semibold">{t("characteristic.evidenceOther")}</summary>
                <EvidenceList items={other} />
              </details>
            ) : null}
          </>
        )}
        {answer.evidenceIds.length === 0 ? (
          <p className="bg-heat-mid text-warning rounded-lg px-3 py-2 text-sm" data-testid="sa-no-evidence">
            {t("characteristic.noEvidence")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
