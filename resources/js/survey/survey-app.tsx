import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { survey as en } from '@/i18n/en/survey';
import { survey as id } from '@/i18n/id/survey';
import { deleteDraft, emptyDraft, loadDraft, saveDraft } from './draft-store';
import type { SurveyDraft } from './draft-store';

// Aplikasi survei di peramban (docs/01 M3), dibawa dari v1 src/app/s/[token]/survey-app.tsx: satu karakteristik per
// layar, kartu pernyataan tanpa nomor tingkat, draf di IndexedDB, dan pengiriman sekali di akhir yang diulang otomatis
// bila sambungan terputus. Seluruh perpindahan layar terjadi di perangkat, sehingga pengisian tetap berjalan tanpa
// sinyal. Paket ini tidak memuat kode konsol.

type Lang = 'id' | 'en';
type Text = { id: string; en: string | null };
type Tree = { [key: string]: string | Tree };

export type SurveyData = {
    organization: string;
    consent: { id: string; en: string };
    closesAt: string | null;
    needsStratum: boolean;
    strata: { id: string; name: string }[];
    characteristics: { id: string; code: string; name: Text; statements: { id: string; text: Text }[] }[];
    climateScreens: { id: string; text: Text }[][];
    draftKey: string;
    openUrl: string;
    submitUrl: string;
    logo: string;
};

type Screen =
    | { kind: 'language' }
    | { kind: 'consent' }
    | { kind: 'stratum' }
    | { kind: 'intro' }
    | { kind: 'A'; index: number }
    | { kind: 'B'; index: number }
    | { kind: 'review' };

type Failure = 'INVALID' | 'USED' | 'CLOSED' | 'NOT_OPEN' | 'ERROR';
type SendState = 'idle' | 'sending' | 'waiting' | 'done' | 'declined' | { failed: Failure };

const NOMINAL_MINUTES = 15;
const RETRY_DELAYS_MS = [3_000, 6_000, 12_000, 20_000, 30_000];
const MESSAGES: Record<Lang, Tree> = { id, en };

function translator(lang: Lang) {
    return (key: string, values?: Record<string, string | number>): string => {
        const find = (tree: Tree): string | undefined => {
            let node: string | Tree | undefined = tree;
            for (const part of key.split('.')) {
                node = typeof node === 'object' ? node[part] : undefined;
            }
            return typeof node === 'string' ? node : undefined;
        };
        const template = find(MESSAGES[lang]) ?? find(MESSAGES.id) ?? key;
        return values
            ? template.replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? String(values[name]) : m))
            : template;
    };
}

function pick(text: Text, lang: Lang): string {
    return lang === 'en' && text.en ? text.en : text.id;
}

function formatWib(value: string, lang: Lang): string {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
}

export function SurveyApp({ data }: { data: SurveyData }) {
    const [draft, setDraft] = useState<SurveyDraft | null>(null);
    const lang: Lang = draft?.language ?? 'id';

    useEffect(() => {
        let active = true;
        void loadDraft(data.draftKey).then((stored) => {
            if (active) {
                setDraft(stored ?? emptyDraft());
            }
        });
        // Menandai tautan pernah dibuka; gagal tanpa sambungan tidak masalah.
        fetch(data.openUrl, { method: 'POST', keepalive: true }).catch(() => undefined);
        return () => {
            active = false;
        };
    }, [data.draftKey, data.openUrl]);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    return draft ? (
        <Survey data={data} draft={draft} setDraft={setDraft} lang={lang} />
    ) : (
        <div className="sv-page" aria-busy="true" />
    );
}

function Survey({
    data,
    draft,
    setDraft,
    lang,
}: {
    data: SurveyData;
    draft: SurveyDraft;
    setDraft: (d: SurveyDraft) => void;
    lang: Lang;
}) {
    const t = useMemo(() => translator(lang), [lang]);
    const [send, setSend] = useState<SendState>('idle');
    const [online, setOnline] = useState(true);
    const retry = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const screens = useMemo<Screen[]>(
        () => [
            { kind: 'language' },
            { kind: 'consent' },
            ...(data.needsStratum ? [{ kind: 'stratum' } as const] : []),
            { kind: 'intro' },
            ...data.characteristics.map((_, index) => ({ kind: 'A', index }) as const),
            ...data.climateScreens.map((_, index) => ({ kind: 'B', index }) as const),
            { kind: 'review' },
        ],
        [data],
    );
    const step = Math.min(draft.step, screens.length - 1);
    const screen = screens[step] as Screen;
    const questionScreens = data.characteristics.length + data.climateScreens.length;
    const position =
        screen.kind === 'A'
            ? screen.index + 1
            : screen.kind === 'B'
              ? data.characteristics.length + screen.index + 1
              : screen.kind === 'review'
                ? questionScreens
                : 0;

    const update = useCallback(
        (patch: Partial<SurveyDraft>) => {
            const next = { ...draft, ...patch };
            setDraft(next);
            void saveDraft(data.draftKey, next);
        },
        [draft, data.draftKey, setDraft],
    );

    const go = (to: number) => {
        update({ step: Math.max(0, Math.min(to, screens.length - 1)) });
        window.scrollTo({ top: 0 });
    };

    useEffect(() => {
        setOnline(navigator.onLine);
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, []);

    const submitRef = useRef<() => Promise<void>>(async () => undefined);
    const later = () => {
        const delay = RETRY_DELAYS_MS[Math.min(retry.current, RETRY_DELAYS_MS.length - 1)] as number;
        retry.current += 1;
        setSend('waiting');
        timer.current = setTimeout(() => void submitRef.current(), delay);
    };

    const submit = useCallback(async () => {
        if (timer.current) {
            clearTimeout(timer.current);
        }
        const finishedAt = draft.finishedAt ?? Date.now();
        if (!draft.finishedAt) {
            update({ finishedAt });
        }
        setSend('sending');
        const body = {
            language: lang,
            stratumId: data.needsStratum ? draft.stratumId : null,
            durationSeconds: Math.max(0, Math.round((finishedAt - (draft.startedAt ?? finishedAt)) / 1000)),
            characteristics: data.characteristics.map((c) => ({
                characteristicId: c.id,
                statementId: draft.answers[c.id] ?? null,
            })),
            climate: data.climateScreens.flat().map((i) => ({ itemId: i.id, value: draft.climate[i.id] as number })),
        };
        let response: Response;
        try {
            response = await fetch(data.submitUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(body),
                cache: 'no-store',
            });
        } catch {
            // Tanpa sambungan: tunggu, lalu kirim ulang otomatis.
            later();
            return;
        }
        if (response.ok || response.status === 409) {
            const code = response.ok ? null : ((await response.json().catch(() => ({}))) as { error?: string }).error;
            if (response.ok || code === 'ALREADY_SUBMITTED') {
                await deleteDraft(data.draftKey);
                setSend('done');
                window.scrollTo({ top: 0 });
                return;
            }
            setSend({ failed: code === 'SURVEY_NOT_OPEN' ? 'NOT_OPEN' : 'CLOSED' });
            return;
        }
        if (response.status === 404) {
            setSend({ failed: 'INVALID' });
            return;
        }
        if (response.status >= 500 || response.status === 429) {
            later();
            return;
        }
        setSend({ failed: 'ERROR' });
    }, [data, draft, lang, update]);

    useEffect(() => {
        submitRef.current = submit;
    }, [submit]);

    // Sambungan kembali: kirim ulang segera tanpa menunggu jeda.
    useEffect(() => {
        if (online && send === 'waiting') {
            retry.current = 0;
            void submitRef.current();
        }
    }, [online, send]);

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    const header = (
        <header className="sv-header">
            <img src={data.logo} alt="NSCAS Nusa Safety" width={132} height={45} />
            <button
                type="button"
                className="sv-link"
                lang={lang === 'id' ? 'en' : 'id'}
                onClick={() => update({ language: lang === 'id' ? 'en' : 'id' })}
            >
                {t('switchLanguage')}
            </button>
        </header>
    );

    if (send === 'done') {
        return <Message header={header} title={t('done.title')} body={[t('done.body'), t('done.close')]} testId="survey-done" />;
    }
    if (send === 'declined') {
        return (
            <Message
                header={header}
                title={t('consent.declinedTitle')}
                body={[t('consent.declinedBody')]}
                testId="survey-declined"
            >
                <button type="button" className="sv-button sv-secondary" onClick={() => setSend('idle')}>
                    {t('consent.changeMind')}
                </button>
            </Message>
        );
    }
    if (typeof send === 'object') {
        return (
            <Message
                header={header}
                title={t(`status.${send.failed}.title`)}
                body={[t(`status.${send.failed}.body`)]}
                testId="survey-failed"
            />
        );
    }

    const answered =
        screen.kind === 'A'
            ? (data.characteristics[screen.index] as { id: string }).id in draft.answers
            : screen.kind === 'B'
              ? (data.climateScreens[screen.index] ?? []).every((i) => draft.climate[i.id] !== undefined)
              : screen.kind === 'stratum'
                ? draft.stratumId !== null
                : true;
    const remainingMinutes = Math.ceil(((questionScreens - position) * NOMINAL_MINUTES) / questionScreens);
    const withNav = screen.kind === 'A' || screen.kind === 'B' || screen.kind === 'stratum';
    const percent = Math.round((position / questionScreens) * 100);
    const englishFallback =
        lang === 'en' && (screen.kind === 'A' || screen.kind === 'B') && data.characteristics.some((c) => c.name.en === null);

    return (
        <div className={`sv-page ${withNav ? 'sv-with-nav' : ''}`}>
            {header}
            {!online ? (
                <p role="status" className="sv-notice" data-testid="survey-offline">
                    {t('offline.banner')}
                </p>
            ) : null}
            {position > 0 ? (
                <div className="sv-progress">
                    <div
                        className="sv-bar"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                        aria-label={t('progress', { percent })}
                    >
                        <div style={{ width: `${percent}%` }} />
                    </div>
                    <p className="sv-muted" data-testid="survey-remaining">
                        {remainingMinutes >= 1 ? t('remaining', { minutes: remainingMinutes }) : t('remainingLessThanOne')}
                    </p>
                </div>
            ) : null}
            {englishFallback ? <p className="sv-muted">{t('contentInIndonesian')}</p> : null}

            <main className="sv-main">
                {screen.kind === 'language' ? (
                    <section className="sv-stack" data-testid="survey-language">
                        <p className="sv-eyebrow">{data.organization}</p>
                        <h1>{t('heading')}</h1>
                        <h2>{t('language.title')}</h2>
                        <p>{t('language.intro')}</p>
                        {(['id', 'en'] as const).map((l) => (
                            <button
                                key={l}
                                type="button"
                                lang={l}
                                className="sv-card sv-strong"
                                onClick={() => update({ language: l, step: step + 1 })}
                            >
                                {t(`language.${l}`)}
                            </button>
                        ))}
                    </section>
                ) : null}

                {screen.kind === 'consent' ? (
                    <section className="sv-stack">
                        <h1>{t('consent.title')}</h1>
                        <div className="sv-consent" data-testid="survey-consent">
                            {lang === 'en' && data.consent.en ? data.consent.en : data.consent.id}
                        </div>
                        {data.closesAt ? <p>{t('closesAt', { date: formatWib(data.closesAt, lang) })}</p> : null}
                        <button
                            type="button"
                            className="sv-button sv-primary"
                            data-testid="survey-accept"
                            onClick={() => update({ consented: true, startedAt: draft.startedAt ?? Date.now(), step: step + 1 })}
                        >
                            {t('consent.accept')}
                        </button>
                        <button
                            type="button"
                            className="sv-button sv-secondary"
                            onClick={() => {
                                void deleteDraft(data.draftKey);
                                setDraft({ ...emptyDraft(), language: lang, step });
                                setSend('declined');
                            }}
                        >
                            {t('consent.decline')}
                        </button>
                    </section>
                ) : null}

                {screen.kind === 'stratum' ? (
                    <fieldset className="sv-stack">
                        <legend>
                            <h1>{t('stratum.title')}</h1>
                        </legend>
                        <p>{t('stratum.intro')}</p>
                        {data.strata.map((s) => (
                            <Choice
                                key={s.id}
                                name="stratum"
                                checked={draft.stratumId === s.id}
                                onChange={() => update({ stratumId: s.id })}
                            >
                                {s.name}
                            </Choice>
                        ))}
                    </fieldset>
                ) : null}

                {screen.kind === 'intro' ? (
                    <section className="sv-stack">
                        <h1>{t('intro.title')}</h1>
                        <p>{t('intro.partA', { count: data.characteristics.length })}</p>
                        <p>{t('intro.partB', { count: data.climateScreens.flat().length })}</p>
                        <p>{t('intro.honest')}</p>
                        <p className="sv-muted">{t('intro.anonymous')}</p>
                        <button
                            type="button"
                            className="sv-button sv-primary"
                            data-testid="survey-start"
                            onClick={() => go(step + 1)}
                        >
                            {t('intro.start')}
                        </button>
                    </section>
                ) : null}

                {screen.kind === 'A'
                    ? (() => {
                          const c = data.characteristics[screen.index] as SurveyData['characteristics'][number];
                          const value = c.id in draft.answers ? draft.answers[c.id] : undefined;
                          const choose = (statementId: string | null) =>
                              update({ answers: { ...draft.answers, [c.id]: statementId } });
                          return (
                              <fieldset key={c.id} className="sv-stack" data-testid="survey-characteristic" data-code={c.code}>
                                  <legend>
                                      <span className="sv-eyebrow">
                                          {t('partA.label')} ·{' '}
                                          {t('partA.question', { current: screen.index + 1, total: data.characteristics.length })}
                                      </span>
                                      <span className="sv-question">{pick(c.name, lang)}</span>
                                      <span className="sv-muted">{t('partA.instruction')}</span>
                                  </legend>
                                  {c.statements.map((s) => (
                                      <Choice
                                          key={s.id}
                                          name={`c-${c.id}`}
                                          checked={value === s.id}
                                          onChange={() => choose(s.id)}
                                      >
                                          {pick(s.text, lang)}
                                      </Choice>
                                  ))}
                                  <Choice name={`c-${c.id}`} checked={value === null} onChange={() => choose(null)} light>
                                      {t('partA.dontKnow')}
                                  </Choice>
                              </fieldset>
                          );
                      })()
                    : null}

                {screen.kind === 'B' ? (
                    <section key={screen.index} className="sv-stack" data-testid="survey-climate">
                        <div>
                            <p className="sv-eyebrow">
                                {t('partB.label')} ·{' '}
                                {t('partB.screen', { current: screen.index + 1, total: data.climateScreens.length })}
                            </p>
                            <p className="sv-strong">{t('partB.instruction')}</p>
                        </div>
                        {(data.climateScreens[screen.index] ?? []).map((item) => (
                            <fieldset key={item.id} className="sv-stack sv-item" data-testid="survey-climate-item">
                                <legend className="sv-question-small">{pick(item.text, lang)}</legend>
                                {[1, 2, 3, 4, 5].map((v) => (
                                    <Choice
                                        key={v}
                                        name={`i-${item.id}`}
                                        checked={draft.climate[item.id] === v}
                                        onChange={() => update({ climate: { ...draft.climate, [item.id]: v } })}
                                        compact
                                    >
                                        {t(`scale.${v}`)}
                                    </Choice>
                                ))}
                            </fieldset>
                        ))}
                    </section>
                ) : null}

                {screen.kind === 'review' ? (
                    <section className="sv-stack" data-testid="survey-review">
                        <h1>{t('review.title')}</h1>
                        <p>{t('review.body')}</p>
                        {send === 'waiting' ? (
                            <p role="status" className="sv-notice" data-testid="survey-waiting">
                                {t('offline.waiting')}
                            </p>
                        ) : null}
                        <button
                            type="button"
                            className="sv-button sv-primary"
                            onClick={() => void submit()}
                            disabled={send === 'sending'}
                            data-testid="survey-submit"
                        >
                            {send === 'sending'
                                ? t('review.sending')
                                : send === 'waiting'
                                  ? t('offline.retry')
                                  : t('review.submit')}
                        </button>
                        <button
                            type="button"
                            className="sv-button sv-secondary"
                            onClick={() => go(step - 1)}
                            disabled={send === 'sending'}
                        >
                            {t('nav.back')}
                        </button>
                    </section>
                ) : null}
            </main>

            {withNav ? (
                <nav className="sv-nav" aria-label={t('progress', { percent })}>
                    <div>
                        <button type="button" className="sv-button sv-secondary" onClick={() => go(step - 1)}>
                            {t('nav.back')}
                        </button>
                        <button
                            type="button"
                            className="sv-button sv-primary"
                            onClick={() => go(step + 1)}
                            disabled={!answered}
                            aria-describedby={answered ? undefined : 'answer-first'}
                            data-testid="survey-next"
                        >
                            {t('nav.next')}
                        </button>
                    </div>
                    {!answered ? (
                        <p id="answer-first" className="sv-sr-only">
                            {t('nav.answerFirst')}
                        </p>
                    ) : null}
                </nav>
            ) : null}
        </div>
    );
}

function Choice({
    name,
    checked,
    onChange,
    light,
    compact,
    children,
}: {
    name: string;
    checked: boolean;
    onChange: () => void;
    light?: boolean;
    compact?: boolean;
    children: ReactNode;
}) {
    return (
        <label
            className={`sv-card ${light ? 'sv-card-light' : ''} ${compact ? 'sv-card-compact' : ''} ${checked ? 'sv-checked' : ''}`}
        >
            <input type="radio" name={name} className="sv-sr-only" checked={checked} onChange={onChange} />
            <span aria-hidden className="sv-dot" />
            <span>{children}</span>
        </label>
    );
}

function Message({
    header,
    title,
    body,
    testId,
    children,
}: {
    header: ReactNode;
    title: string;
    body: string[];
    testId: string;
    children?: ReactNode;
}) {
    return (
        <div className="sv-page">
            {header}
            <main className="sv-main">
                <div className="sv-stack" data-testid={testId}>
                    <h1>{title}</h1>
                    {body.map((p) => (
                        <p key={p}>{p}</p>
                    ))}
                    {children}
                </div>
            </main>
        </div>
    );
}
