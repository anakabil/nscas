"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NextIntlClientProvider, useTranslations, type AbstractIntlMessages } from "next-intl";
import { deleteDraft, emptyDraft, loadDraft, saveDraft, type SurveyDraft } from "./draft-store";

// Aplikasi survei di peramban (docs/01 M3, docs/05 bagian 3): satu karakteristik per layar, kartu pernyataan
// tanpa nomor tingkat, draf di IndexedDB, dan pengiriman sekali di akhir yang diulang otomatis bila sambungan
// terputus. Seluruh perpindahan layar terjadi di perangkat, sehingga pengisian tetap berjalan tanpa sinyal.

type Lang = "id" | "en";
type Text = { id: string; en: string | null };

export interface SurveyAppProps {
  token: string;
  draftKey: string;
  organizationName: string;
  /** Tanggal tutup yang sudah diformat per bahasa (WIB). */
  closesAt: Record<Lang, string> | null;
  consent: { id: string; en: string };
  needsStratum: boolean;
  content: {
    characteristics: { id: string; code: string; name: Text; statements: { id: string; text: Text }[] }[];
    climateScreens: { id: string; text: Text }[][];
    strata: { id: string; name: string }[];
  };
  messages: Record<Lang, AbstractIntlMessages>;
  initialLanguage: Lang;
}

type Screen =
  | { kind: "language" }
  | { kind: "consent" }
  | { kind: "stratum" }
  | { kind: "intro" }
  | { kind: "A"; index: number }
  | { kind: "B"; index: number }
  | { kind: "review" };

type SendState = "idle" | "sending" | "waiting" | "done" | "declined" | { failed: "INVALID" | "USED" | "CLOSED" | "NOT_OPEN" | "ERROR" };

const NOMINAL_MINUTES = 15;
const RETRY_DELAYS_MS = [3_000, 6_000, 12_000, 20_000, 30_000];

export function SurveyApp(props: SurveyAppProps) {
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const lang: Lang = draft?.language ?? props.initialLanguage;

  useEffect(() => {
    let active = true;
    loadDraft(props.draftKey).then((stored) => {
      if (active) setDraft(stored ?? emptyDraft());
    });
    // Menandai tautan pernah dibuka; gagal tanpa sambungan tidak masalah.
    fetch(`/s/${props.token}/open`, { method: "POST", keepalive: true }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [props.draftKey, props.token]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <NextIntlClientProvider locale={lang} messages={{ survey: props.messages[lang] }} timeZone="Asia/Jakarta">
      {draft ? <Survey {...props} draft={draft} setDraft={setDraft} lang={lang} /> : <div className="min-h-dvh" aria-busy="true" />}
    </NextIntlClientProvider>
  );
}

function pick(text: Text, lang: Lang): string {
  return lang === "en" && text.en ? text.en : text.id;
}

function Survey({
  token,
  draftKey,
  organizationName,
  closesAt,
  consent,
  needsStratum,
  content,
  draft,
  setDraft,
  lang,
}: SurveyAppProps & { draft: SurveyDraft; setDraft: (d: SurveyDraft) => void; lang: Lang }) {
  const t = useTranslations("survey");
  const [send, setSend] = useState<SendState>("idle");
  const [online, setOnline] = useState(true);
  const retry = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const screens = useMemo<Screen[]>(
    () => [
      { kind: "language" },
      { kind: "consent" },
      ...(needsStratum ? [{ kind: "stratum" } as const] : []),
      { kind: "intro" },
      ...content.characteristics.map((_, index) => ({ kind: "A", index }) as const),
      ...content.climateScreens.map((_, index) => ({ kind: "B", index }) as const),
      { kind: "review" },
    ],
    [needsStratum, content],
  );
  const step = Math.min(draft.step, screens.length - 1);
  const screen = screens[step] as Screen;
  const questionScreens = content.characteristics.length + content.climateScreens.length;
  const position = screen.kind === "A" ? screen.index + 1 : screen.kind === "B" ? content.characteristics.length + screen.index + 1 : screen.kind === "review" ? questionScreens : 0;

  const update = useCallback(
    (patch: Partial<SurveyDraft>) => {
      const next = { ...draft, ...patch };
      setDraft(next);
      void saveDraft(draftKey, next);
    },
    [draft, draftKey, setDraft],
  );

  const go = (to: number) => {
    update({ step: Math.max(0, Math.min(to, screens.length - 1)) });
    top.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const submit = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const finishedAt = draft.finishedAt ?? Date.now();
    if (!draft.finishedAt) update({ finishedAt });
    setSend("sending");
    const body = {
      language: lang,
      stratumId: needsStratum ? draft.stratumId : null,
      durationSeconds: Math.max(0, Math.round((finishedAt - (draft.startedAt ?? finishedAt)) / 1000)),
      characteristics: content.characteristics.map((c) => ({ characteristicId: c.id, statementId: draft.answers[c.id] ?? null })),
      climate: content.climateScreens.flat().map((i) => ({ itemId: i.id, value: draft.climate[i.id] as number })),
    };
    let response: Response;
    try {
      response = await fetch(`/s/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      // Tanpa sambungan: tunggu, lalu kirim ulang otomatis.
      const delay = RETRY_DELAYS_MS[Math.min(retry.current, RETRY_DELAYS_MS.length - 1)] as number;
      retry.current += 1;
      setSend("waiting");
      timer.current = setTimeout(() => void submitRef.current?.(), delay);
      return;
    }
    if (response.ok || response.status === 409) {
      const code = response.ok ? null : ((await response.json().catch(() => ({}))) as { error?: string }).error;
      if (response.ok || code === "ALREADY_SUBMITTED") {
        await deleteDraft(draftKey);
        setSend("done");
        window.scrollTo({ top: 0 });
        return;
      }
      setSend({ failed: code === "SURVEY_NOT_OPEN" ? "NOT_OPEN" : "CLOSED" });
      return;
    }
    if (response.status === 404) return setSend({ failed: "INVALID" });
    if (response.status >= 500 || response.status === 429) {
      const delay = RETRY_DELAYS_MS[Math.min(retry.current, RETRY_DELAYS_MS.length - 1)] as number;
      retry.current += 1;
      setSend("waiting");
      timer.current = setTimeout(() => void submitRef.current?.(), delay);
      return;
    }
    setSend({ failed: "ERROR" });
  }, [content, draft, draftKey, lang, needsStratum, token, update]);

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // Sambungan kembali: kirim ulang segera tanpa menunggu jeda.
  useEffect(() => {
    if (online && send === "waiting") {
      retry.current = 0;
      void submitRef.current();
    }
  }, [online, send]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (send === "done") return <Message title={t("done.title")} body={[t("done.body"), t("done.close")]} testId="survey-done" />;
  if (send === "declined") {
    return (
      <Message title={t("consent.declinedTitle")} body={[t("consent.declinedBody")]} testId="survey-declined">
        <button type="button" className="survey-secondary" onClick={() => setSend("idle")}>
          {t("consent.changeMind")}
        </button>
      </Message>
    );
  }
  if (typeof send === "object") {
    return <Message title={t(`status.${send.failed}.title`)} body={[t(`status.${send.failed}.body`)]} testId="survey-failed" />;
  }

  const answered =
    screen.kind === "A"
      ? (content.characteristics[screen.index] as { id: string }).id in draft.answers
      : screen.kind === "B"
        ? (content.climateScreens[screen.index] ?? []).every((i) => draft.climate[i.id] !== undefined)
        : screen.kind === "stratum"
          ? draft.stratumId !== null
          : true;
  const remainingMinutes = Math.ceil(((questionScreens - position) * NOMINAL_MINUTES) / questionScreens);
  const withNav = screen.kind === "A" || screen.kind === "B" || screen.kind === "stratum";

  return (
    <div className="survey mx-auto flex min-h-dvh max-w-xl flex-col" ref={top}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4">
        <p className="text-muted-foreground text-sm font-semibold">{organizationName}</p>
        <button
          type="button"
          className="text-brand-navy min-h-12 shrink-0 px-2 text-sm font-semibold underline underline-offset-4"
          onClick={() => update({ language: lang === "id" ? "en" : "id" })}
          lang={lang === "id" ? "en" : "id"}
        >
          {t("switchLanguage")}
        </button>
      </header>

      {!online ? (
        <p role="status" className="bg-heat-mid text-warning mx-4 mt-3 rounded-lg px-3 py-2 text-sm" data-testid="survey-offline">
          {t("offline.banner")}
        </p>
      ) : null}

      {position > 0 ? <Progress position={position} total={questionScreens} remainingMinutes={remainingMinutes} /> : null}

      <main className={`flex-1 px-4 pt-4 ${withNav ? "pb-28" : "pb-8"}`}>
        {screen.kind === "language" ? (
          <section className="space-y-4">
            <h1 className="text-brand-navy text-2xl leading-tight font-bold">{t("heading")}</h1>
            <h2 className="text-lg font-semibold">{t("language.title")}</h2>
            <p>{t("language.intro")}</p>
            <div className="space-y-3">
              {(["id", "en"] as const).map((l) => (
                <button key={l} type="button" lang={l} className="survey-card w-full text-left font-semibold" onClick={() => update({ language: l, step: step + 1 })}>
                  {t(`language.${l}`)}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {screen.kind === "consent" ? (
          <section className="space-y-4">
            <h1 className="text-brand-navy text-2xl leading-tight font-bold">{t("consent.title")}</h1>
            <div className="border-border bg-card rounded-xl border p-4 text-base whitespace-pre-line" data-testid="survey-consent">
              {lang === "en" && consent.en ? consent.en : consent.id}
            </div>
            {closesAt ? <p className="text-base">{t("closesAt", { date: closesAt[lang] })}</p> : null}
            <button
              type="button"
              className="survey-primary w-full"
              onClick={() => update({ consented: true, startedAt: draft.startedAt ?? Date.now(), step: step + 1 })}
            >
              {t("consent.accept")}
            </button>
            <button
              type="button"
              className="survey-secondary w-full"
              onClick={() => {
                void deleteDraft(draftKey);
                setDraft({ ...emptyDraft(), language: lang, step });
                setSend("declined");
              }}
            >
              {t("consent.decline")}
            </button>
          </section>
        ) : null}

        {screen.kind === "stratum" ? (
          <fieldset className="space-y-4">
            <legend className="text-brand-navy mb-2 text-2xl leading-tight font-bold">{t("stratum.title")}</legend>
            <p>{t("stratum.intro")}</p>
            <div className="space-y-3">
              {content.strata.map((s) => (
                <label key={s.id} className="survey-card block">
                  <input type="radio" name="stratum" className="sr-only" checked={draft.stratumId === s.id} onChange={() => update({ stratumId: s.id })} />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {screen.kind === "intro" ? (
          <section className="space-y-4">
            <h1 className="text-brand-navy text-2xl leading-tight font-bold">{t("intro.title")}</h1>
            <p>{t("intro.partA", { count: content.characteristics.length })}</p>
            <p>{t("intro.partB", { count: content.climateScreens.flat().length })}</p>
            <p>{t("intro.honest")}</p>
            <p className="text-muted-foreground text-base">{t("intro.anonymous")}</p>
            <button type="button" className="survey-primary w-full" onClick={() => go(step + 1)}>
              {t("intro.start")}
            </button>
          </section>
        ) : null}

        {screen.kind === "A" ? (
          <CharacteristicScreen
            key={screen.index}
            characteristic={content.characteristics[screen.index] as SurveyAppProps["content"]["characteristics"][number]}
            current={screen.index + 1}
            total={content.characteristics.length}
            lang={lang}
            selected={draft.answers}
            onSelect={(characteristicId, statementId) => update({ answers: { ...draft.answers, [characteristicId]: statementId } })}
          />
        ) : null}

        {screen.kind === "B" ? (
          <ClimateScreen
            key={screen.index}
            items={content.climateScreens[screen.index] ?? []}
            index={screen.index}
            total={content.climateScreens.length}
            lang={lang}
            values={draft.climate}
            onSelect={(itemId, value) => update({ climate: { ...draft.climate, [itemId]: value } })}
          />
        ) : null}

        {screen.kind === "review" ? (
          <section className="space-y-4" data-testid="survey-review">
            <h1 className="text-brand-navy text-2xl leading-tight font-bold">{t("review.title")}</h1>
            <p>{t("review.body")}</p>
            {send === "waiting" ? (
              <p role="status" className="bg-heat-mid text-warning rounded-lg px-3 py-2 text-base" data-testid="survey-waiting">
                {t("offline.waiting")}
              </p>
            ) : null}
            <button type="button" className="survey-primary w-full" onClick={() => void submit()} disabled={send === "sending"} data-testid="survey-submit">
              {send === "sending" ? t("review.sending") : send === "waiting" ? t("offline.retry") : t("review.submit")}
            </button>
            <button type="button" className="survey-secondary w-full" onClick={() => go(step - 1)} disabled={send === "sending"}>
              {t("nav.back")}
            </button>
          </section>
        ) : null}
      </main>

      {withNav ? (
        <nav className="border-border bg-background fixed inset-x-0 bottom-0 border-t" aria-label={t("progress", { percent: Math.round((position / questionScreens) * 100) })}>
          <div className="mx-auto flex max-w-xl gap-3 px-4 py-3">
            <button type="button" className="survey-secondary flex-1" onClick={() => go(step - 1)}>
              {t("nav.back")}
            </button>
            <button type="button" className="survey-primary flex-1" onClick={() => go(step + 1)} disabled={!answered} aria-describedby={answered ? undefined : "answer-first"}>
              {t("nav.next")}
            </button>
          </div>
          {!answered ? (
            <p id="answer-first" className="sr-only">
              {t("nav.answerFirst")}
            </p>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function Progress({ position, total, remainingMinutes }: { position: number; total: number; remainingMinutes: number }) {
  const t = useTranslations("survey");
  const percent = Math.round((position / total) * 100);
  return (
    <div className="space-y-1 px-4 pt-3">
      <div className="bg-border h-2 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t("progress", { percent })}>
        <div className="bg-brand-navy h-full" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-muted-foreground text-sm" data-testid="survey-remaining">
        {remainingMinutes >= 1 ? t("remaining", { minutes: remainingMinutes }) : t("remainingLessThanOne")}
      </p>
    </div>
  );
}

function CharacteristicScreen({
  characteristic,
  current,
  total,
  lang,
  selected,
  onSelect,
}: {
  characteristic: SurveyAppProps["content"]["characteristics"][number];
  current: number;
  total: number;
  lang: Lang;
  selected: Record<string, string | null>;
  onSelect: (characteristicId: string, statementId: string | null) => void;
}) {
  const t = useTranslations("survey");
  const value = characteristic.id in selected ? selected[characteristic.id] : undefined;
  return (
    <fieldset className="space-y-3" data-testid="survey-characteristic" data-code={characteristic.code}>
      <legend className="mb-1 space-y-1">
        <span className="text-brand-navy block text-sm font-semibold" data-testid="survey-question">
          {t("partA.label")} · {t("partA.question", { current, total })}
        </span>
        <span className="block text-xl leading-snug font-bold">{pick(characteristic.name, lang)}</span>
        <span className="text-muted-foreground block text-base">{t("partA.instruction")}</span>
      </legend>
      {characteristic.statements.map((s) => (
        <label key={s.id} className="survey-card block">
          <input type="radio" name={`c-${characteristic.id}`} className="sr-only" checked={value === s.id} onChange={() => onSelect(characteristic.id, s.id)} />
          {pick(s.text, lang)}
        </label>
      ))}
      <label className="survey-card survey-card-light block">
        <input type="radio" name={`c-${characteristic.id}`} className="sr-only" checked={value === null} onChange={() => onSelect(characteristic.id, null)} />
        {t("partA.dontKnow")}
      </label>
    </fieldset>
  );
}

function ClimateScreen({
  items,
  index,
  total,
  lang,
  values,
  onSelect,
}: {
  items: { id: string; text: Text }[];
  index: number;
  total: number;
  lang: Lang;
  values: Record<string, number>;
  onSelect: (itemId: string, value: number) => void;
}) {
  const t = useTranslations("survey");
  return (
    <section className="space-y-6" data-testid="survey-climate">
      <div className="space-y-1">
        <p className="text-brand-navy text-sm font-semibold">
          {t("partB.label")} · {t("partB.screen", { current: index + 1, total })}
        </p>
        <p className="text-base font-semibold">{t("partB.instruction")}</p>
      </div>
      {items.map((item) => (
        <fieldset key={item.id} className="space-y-2" data-testid="survey-climate-item">
          <legend className="mb-2 text-lg leading-snug font-semibold">{pick(item.text, lang)}</legend>
          {[1, 2, 3, 4, 5].map((v) => (
            <label key={v} className="survey-card survey-card-compact block">
              <input type="radio" name={`i-${item.id}`} className="sr-only" checked={values[item.id] === v} onChange={() => onSelect(item.id, v)} />
              {t(`scale.${v}`)}
            </label>
          ))}
        </fieldset>
      ))}
    </section>
  );
}

function Message({ title, body, testId, children }: { title: string; body: string[]; testId: string; children?: React.ReactNode }) {
  return (
    <main className="survey mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-10" data-testid={testId}>
      <h1 className="text-brand-navy text-2xl leading-tight font-bold">{title}</h1>
      {body.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {children}
    </main>
  );
}
