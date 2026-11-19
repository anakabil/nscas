import { useEffect, useMemo, useState } from 'react';
import { selfAssessmentForm as en } from '@/i18n/en/self-assessment-form';
import { selfAssessmentForm as id } from '@/i18n/id/self-assessment-form';
import { QuestionList } from '../survey/question-list';
import type { ListGroup } from '../survey/question-list';

// Formulir penilaian mandiri (docs/01 M4), dibawa dari v1 src/app/sa/[token]/self-assessment-form.tsx: satu
// karakteristik per layar, draf disimpan ke server setiap kali berpindah layar, lalu dikirim sekali setelah semua
// karakteristik lengkap. Pernyataan tampil tanpa nomor tingkat. Paket ini tidak memuat kode konsol.

type Lang = 'id' | 'en';
type Text = { id: string; en: string | null };
type Tree = { [key: string]: string | Tree };
type Answer = { statementId: string | null; justification: string; evidenceIds: string[] };
type Characteristic = { id: string; code: string; name: Text; statements: { id: string; text: Text }[]; answer: Answer };
type Evidence = { id: string; title: string; version: number; characteristicIds: string[] };

export type FormData = {
    organization: string;
    profile: { name: string; position: string };
    status: 'DRAFT' | 'SUBMITTED';
    submittedAt: string | null;
    minLength: number;
    maxLength: number;
    evidence: Evidence[];
    characteristics: Characteristic[];
    profileUrl: string;
    answerUrl: string;
    submitUrl: string;
    logo: string;
};

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

const pick = (text: Text, lang: Lang) => (lang === 'en' && text.en ? text.en : text.id);
const length = (text: string) => text.trim().replace(/\s+/g, ' ').length;

async function call(url: string, method: 'PUT' | 'POST', body?: unknown): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch(url, {
            method,
            headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
        if (res.ok) {
            return { ok: true };
        }
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: json.error ?? 'INVALID_INPUT' };
    } catch {
        return { ok: false, error: 'NETWORK' };
    }
}

function formatDate(value: string, lang: Lang): string {
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

export function SelfAssessmentApp({ data }: { data: FormData }) {
    const [lang, setLang] = useState<Lang>('id');
    const t = useMemo(() => translator(lang), [lang]);
    const total = data.characteristics.length;
    // -1: halaman pembuka; 0..total-1: karakteristik; total: pemeriksaan akhir.
    const [index, setIndex] = useState(-1);
    const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
        Object.fromEntries(data.characteristics.map((c) => [c.id, c.answer])),
    );
    const [saved, setSaved] = useState<Record<string, Answer>>(answers);
    const [profile, setProfile] = useState(data.profile);
    const [savedProfile, setSavedProfile] = useState(data.profile);
    const [listOpen, setListOpen] = useState(false);
    // Setelah berpindah dari ringkasan, tombol utama membawa kembali ke ringkasan.
    const [returnToReview, setReturnToReview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [submittedAt, setSubmittedAt] = useState<string | null>(data.status === 'SUBMITTED' ? data.submittedAt : null);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    const current = index >= 0 && index < total ? (data.characteristics[index] as Characteristic) : null;
    const dirty = current !== null && JSON.stringify(answers[current.id]) !== JSON.stringify(saved[current.id]);

    // Peringatan peramban bila halaman ditutup sebelum isian layar ini tersimpan.
    useEffect(() => {
        if (!dirty && !busy) {
            return;
        }
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, busy]);

    const header = (
        <header className="sv-header">
            <img src={data.logo} alt="NSCAS Nusa Safety" width={132} height={45} />
            <button
                type="button"
                className="sv-link"
                lang={lang === 'id' ? 'en' : 'id'}
                onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            >
                {t('switchLanguage')}
            </button>
        </header>
    );

    if (submittedAt) {
        return (
            <div className="sv-page">
                {header}
                <main className="sv-main">
                    <div className="sv-stack" data-testid="sa-submitted">
                        <p className="sv-eyebrow">{data.organization}</p>
                        <h1>{t('submitted.title')}</h1>
                        <p>{t('submitted.body', { date: `${formatDate(submittedAt, lang)} WIB` })}</p>
                        <h2>{t('submitted.answers')}</h2>
                        {data.characteristics.map((c) => {
                            const a = answers[c.id] as Answer;
                            const chosen = c.statements.find((s) => s.id === a.statementId);
                            return (
                                <section key={c.id} className="sv-item sv-stack">
                                    <p className="sv-strong">
                                        {c.code} {pick(c.name, lang)}
                                    </p>
                                    {chosen ? <p>{pick(chosen.text, lang)}</p> : null}
                                    <p className="sv-muted">{a.justification}</p>
                                </section>
                            );
                        })}
                    </div>
                </main>
            </div>
        );
    }

    const persist = async (): Promise<boolean> => {
        if (!current) {
            return true;
        }
        const answer = answers[current.id] as Answer;
        if (JSON.stringify(answer) === JSON.stringify(saved[current.id])) {
            return true;
        }
        setBusy(true);
        // Bukti yang sudah dihapus dari modul Bukti tidak ikut dikirim.
        const available = new Set(data.evidence.map((e) => e.id));
        const result = await call(data.answerUrl, 'PUT', {
            characteristicId: current.id,
            ...answer,
            evidenceIds: answer.evidenceIds.filter((id) => available.has(id)),
        });
        setBusy(false);
        if (!result.ok) {
            setError(result.error ?? 'INVALID_INPUT');
            return false;
        }
        setSaved((s) => ({ ...s, [current.id]: answer }));
        setNotice(t('nav.saved'));
        return true;
    };

    const goTo = async (next: number) => {
        setError(null);
        setNotice(null);
        if (!(await persist())) {
            return;
        }
        setListOpen(false);
        setIndex(next);
        window.scrollTo({ top: 0 });
    };

    const statusOf = (c: Characteristic): 'done' | 'partial' | 'todo' => {
        const a = answers[c.id] as Answer;
        if (a.statementId && length(a.justification) >= data.minLength) {
            return 'done';
        }
        return a.statementId || a.justification.trim() !== '' ? 'partial' : 'todo';
    };
    const doneCount = data.characteristics.filter((c) => statusOf(c) === 'done').length;
    const firstIncomplete = data.characteristics.findIndex((c) => statusOf(c) !== 'done');
    const started = data.characteristics.some((c) => statusOf(c) !== 'todo');

    const missing = data.characteristics
        .map((c) => {
            const a = answers[c.id] as Answer;
            const reasons = [
                ...(a.statementId ? [] : ['LEVEL']),
                ...(length(a.justification) >= data.minLength ? [] : ['JUSTIFICATION']),
            ];
            return { characteristic: c, reasons };
        })
        .filter((m) => m.reasons.length > 0);

    const availableEvidence = new Set(data.evidence.map((e) => e.id));
    const withoutEvidence = data.characteristics.filter(
        (c) => !(answers[c.id] as Answer).evidenceIds.some((id) => availableEvidence.has(id)),
    ).length;

    const jump = (to: number) => {
        setReturnToReview(index === total);
        void goTo(to);
    };

    const listGroups: ListGroup[] = [
        {
            key: 'characteristics',
            title: '',
            items: data.characteristics.map((c, i) => {
                const status = statusOf(c);
                return {
                    key: c.id,
                    label: `${c.code} ${pick(c.name, lang)}`,
                    status,
                    statusText: t(`list.statuses.${status}`),
                    current: i === index,
                    onSelect: () => jump(i),
                };
            }),
        },
    ];

    const progress = (
        <div className="sv-stack sv-tight">
            <div
                className="sv-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={doneCount}
                aria-label={t('progress', { done: doneCount, total })}
            >
                <div style={{ width: `${(doneCount / total) * 100}%` }} />
            </div>
            <div className="sv-progress-row">
                <p className="sv-muted" data-testid="sa-progress">
                    {t('progressShort', { done: doneCount, total })}
                </p>
                <button
                    type="button"
                    className="sv-link sv-small"
                    onClick={() => setListOpen(true)}
                    disabled={busy}
                    data-testid="sa-open-list"
                >
                    {t('list.open')}
                </button>
            </div>
            {notice ? (
                <p role="status" className="sv-ok-text sv-note" data-testid="sa-notice">
                    {notice}
                </p>
            ) : null}
        </div>
    );

    const update = (patch: Partial<Answer>) => {
        if (!current) {
            return;
        }
        setAnswers((s) => ({ ...s, [current.id]: { ...(s[current.id] as Answer), ...patch } }));
        setNotice(null);
    };

    const startForm = async () => {
        setError(null);
        if (profile.name !== savedProfile.name || profile.position !== savedProfile.position) {
            setBusy(true);
            const result = await call(data.profileUrl, 'PUT', profile);
            setBusy(false);
            if (!result.ok) {
                setError(result.error ?? 'INVALID_INPUT');
                return;
            }
            setSavedProfile(profile);
        }
        void goTo(firstIncomplete === -1 ? total : firstIncomplete);
    };

    const submit = async () => {
        setBusy(true);
        setError(null);
        const result = await call(data.submitUrl, 'POST');
        setBusy(false);
        if (result.ok) {
            setSubmittedAt(new Date().toISOString());
            window.scrollTo({ top: 0 });
            return;
        }
        setError(result.error ?? 'INVALID_INPUT');
    };

    return (
        <div className="sv-page">
            {header}
            <main className="sv-main">
                <div className="sv-stack">
                    {error ? (
                        <p role="alert" className="sv-alert" data-testid="sa-error">
                            {t(`errors.${error}`)}
                        </p>
                    ) : null}
                    {listOpen ? (
                        <QuestionList
                            title={t('list.title')}
                            closeLabel={t('list.close')}
                            groups={listGroups}
                            onClose={() => setListOpen(false)}
                            footer={
                                <button
                                    type="button"
                                    className="sv-button sv-primary"
                                    onClick={() => jump(total)}
                                    disabled={busy}
                                    data-testid="question-list-review"
                                >
                                    {t('list.review')}
                                </button>
                            }
                        />
                    ) : null}

                    {!listOpen && index === -1 ? (
                        <>
                            <p className="sv-eyebrow">{data.organization}</p>
                            <h1>{t('heading')}</h1>
                            <section className="sv-identified" data-testid="sa-identified">
                                <h2>{t('identified.title')}</h2>
                                <p>{t('identified.body')}</p>
                                <p className="sv-muted">{t('identified.access')}</p>
                            </section>
                            <form
                                className="sv-stack"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void startForm();
                                }}
                            >
                                <h2>{t('profile.title')}</h2>
                                <label className="sv-field">
                                    <span>{t('profile.name')}</span>
                                    <input
                                        className="sv-input"
                                        value={profile.name}
                                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                        autoComplete="name"
                                        required
                                        minLength={2}
                                        maxLength={200}
                                    />
                                </label>
                                <label className="sv-field">
                                    <span>{t('profile.position')}</span>
                                    <input
                                        className="sv-input"
                                        value={profile.position}
                                        onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                                        autoComplete="organization-title"
                                        required
                                        minLength={2}
                                        maxLength={200}
                                    />
                                </label>
                                {started ? <p className="sv-muted">{t('progress', { done: doneCount, total })}</p> : null}
                                <button type="submit" className="sv-button sv-primary" disabled={busy} data-testid="sa-start">
                                    {busy ? t('nav.saving') : started ? t('resume') : t('start')}
                                </button>
                            </form>
                        </>
                    ) : null}

                    {!listOpen && current ? (
                        <>
                            {progress}
                            <CharacteristicStep
                                key={current.id}
                                t={t}
                                lang={lang}
                                characteristic={current}
                                position={index + 1}
                                total={total}
                                minLength={data.minLength}
                                maxLength={data.maxLength}
                                answer={answers[current.id] as Answer}
                                evidence={data.evidence}
                                onChange={update}
                            />
                            <div className="sv-row">
                                <button
                                    type="button"
                                    className="sv-button sv-secondary"
                                    onClick={() => void goTo(index - 1)}
                                    disabled={busy}
                                >
                                    {t('nav.previous')}
                                </button>
                                <button
                                    type="button"
                                    className="sv-button sv-primary"
                                    onClick={() => {
                                        const target = returnToReview || index + 1 >= total ? total : index + 1;
                                        setReturnToReview(false);
                                        void goTo(target);
                                    }}
                                    disabled={busy}
                                    data-testid="sa-next"
                                >
                                    {busy
                                        ? t('nav.saving')
                                        : returnToReview || index + 1 >= total
                                          ? t('nav.saveReview')
                                          : t('nav.saveNext')}
                                </button>
                            </div>
                        </>
                    ) : null}

                    {!listOpen && index === total ? (
                        <section className="sv-stack" data-testid="sa-review">
                            {progress}
                            <h1>{t('review.title')}</h1>
                            {missing.length === 0 ? (
                                <p className="sv-ok">{t('review.complete')}</p>
                            ) : (
                                <p className="sv-alert" data-testid="sa-missing" data-count={missing.length}>
                                    {t('review.incomplete', { count: missing.length })}
                                </p>
                            )}
                            <ol className="sv-qlist">
                                {data.characteristics.map((c, i) => {
                                    const a = answers[c.id] as Answer;
                                    const chosen = c.statements.find((st) => st.id === a.statementId);
                                    const reasons = missing.find((m) => m.characteristic.id === c.id)?.reasons ?? [];
                                    const label = `${c.code} ${pick(c.name, lang)}`;
                                    return (
                                        <li key={c.id} className="sv-review-row sv-review-card" data-testid="sa-review-row">
                                            <div>
                                                <p className="sv-strong">{label}</p>
                                                {chosen ? <p className="sv-answer sv-clamp">{pick(chosen.text, lang)}</p> : null}
                                                {statusOf(c) === 'todo' ? (
                                                    <p className="sv-warn-text">{t('list.statuses.todo')}</p>
                                                ) : reasons.length > 0 ? (
                                                    <p className="sv-warn-text">
                                                        {reasons
                                                            .map((r) => t(`review.reasons.${r}`, { min: data.minLength }))
                                                            .join(', ')}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                className="sv-link sv-small"
                                                aria-label={t('review.editLabel', { label })}
                                                onClick={() => jump(i)}
                                                disabled={busy}
                                            >
                                                {t('review.edit')}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                            {data.evidence.length > 0 && withoutEvidence > 0 ? (
                                <p className="sv-muted" data-testid="sa-without-evidence">
                                    {t('review.withoutEvidence', { count: withoutEvidence })}
                                </p>
                            ) : null}
                            <p>{t('review.warning')}</p>
                            <button
                                type="button"
                                className="sv-button sv-primary"
                                disabled={busy || missing.length > 0}
                                data-testid="sa-submit"
                                onClick={() => void submit()}
                            >
                                {busy ? t('review.submitting') : t('review.submit')}
                            </button>
                        </section>
                    ) : null}
                </div>
            </main>
        </div>
    );
}

function CharacteristicStep({
    t,
    lang,
    characteristic,
    position,
    total,
    minLength,
    maxLength,
    answer,
    evidence,
    onChange,
}: {
    t: ReturnType<typeof translator>;
    lang: Lang;
    characteristic: Characteristic;
    position: number;
    total: number;
    minLength: number;
    maxLength: number;
    answer: Answer;
    evidence: Evidence[];
    onChange: (patch: Partial<Answer>) => void;
}) {
    const count = length(answer.justification);
    return (
        <div className="sv-stack" data-testid="sa-characteristic" data-code={characteristic.code}>
            <fieldset className="sv-stack">
                <legend>
                    <span className="sv-eyebrow" data-testid="sa-position">
                        {t('characteristic.label', { current: position, total })}
                    </span>
                    <span className="sv-question">
                        {characteristic.code} {pick(characteristic.name, lang)}
                    </span>
                    <span className="sv-muted">{t('characteristic.instruction')}</span>
                </legend>
                {characteristic.statements.map((s) => (
                    <label key={s.id} className={`sv-card ${answer.statementId === s.id ? 'sv-checked' : ''}`}>
                        <input
                            type="radio"
                            name={`s-${characteristic.id}`}
                            className="sv-sr-only"
                            checked={answer.statementId === s.id}
                            onChange={() => onChange({ statementId: s.id })}
                        />
                        <span aria-hidden className="sv-dot" />
                        <span>{pick(s.text, lang)}</span>
                    </label>
                ))}
            </fieldset>
            <label className="sv-field">
                <span>{t('characteristic.justification')}</span>
                <span className="sv-muted">{t('characteristic.justificationHint', { min: minLength })}</span>
                <textarea
                    className="sv-input sv-textarea"
                    value={answer.justification}
                    maxLength={maxLength}
                    onChange={(e) => onChange({ justification: e.target.value })}
                    data-testid="sa-justification"
                />
                <span className={count >= minLength ? 'sv-ok-text' : 'sv-muted'} data-testid="sa-counter">
                    {t('characteristic.counter', { count, min: minLength })}
                </span>
            </label>
            <EvidencePicker t={t} characteristic={characteristic} evidence={evidence} answer={answer} onChange={onChange} />
        </div>
    );
}

/** Bukti dari modul Bukti yang dapat ditautkan; bukti yang dipetakan ke karakteristik ini tampil lebih dulu. */
function EvidencePicker({
    t,
    characteristic,
    evidence,
    answer,
    onChange,
}: {
    t: ReturnType<typeof translator>;
    characteristic: Characteristic;
    evidence: Evidence[];
    answer: Answer;
    onChange: (patch: Partial<Answer>) => void;
}) {
    const mapped = evidence.filter((e) => e.characteristicIds.includes(characteristic.id));
    const others = evidence.filter((e) => !e.characteristicIds.includes(characteristic.id));
    const toggle = (id: string) =>
        onChange({
            evidenceIds: answer.evidenceIds.includes(id)
                ? answer.evidenceIds.filter((x) => x !== id)
                : [...answer.evidenceIds, id],
        });
    const list = (items: Evidence[]) => (
        <div className="sv-stack sv-tight">
            {items.map((e) => (
                <label key={e.id} className={`sv-card sv-card-compact ${answer.evidenceIds.includes(e.id) ? 'sv-checked' : ''}`}>
                    <input
                        type="checkbox"
                        className="sv-check"
                        checked={answer.evidenceIds.includes(e.id)}
                        onChange={() => toggle(e.id)}
                        data-testid="sa-evidence"
                    />
                    <span>
                        {e.title}
                        {e.version > 1 ? (
                            <span className="sv-muted"> ({t('evidenceVersion', { version: e.version })})</span>
                        ) : null}
                    </span>
                </label>
            ))}
        </div>
    );

    return (
        <section className="sv-stack">
            <h2>{t('characteristic.evidence')}</h2>
            {evidence.length === 0 ? (
                <p className="sv-muted">{t('characteristic.evidenceNone')}</p>
            ) : (
                <>
                    <p className="sv-muted">{t('characteristic.evidenceHint')}</p>
                    {mapped.length > 0 ? list(mapped) : <p className="sv-muted">{t('characteristic.evidenceNoneMapped')}</p>}
                    {others.length > 0 ? (
                        <details className="sv-details">
                            <summary>{t('characteristic.evidenceOther', { count: others.length })}</summary>
                            <div className="sv-details-body">{list(others)}</div>
                        </details>
                    ) : null}
                </>
            )}
        </section>
    );
}
