import { useEffect, useMemo, useState } from 'react';
import { selfAssessmentForm as en } from '@/i18n/en/self-assessment-form';
import { selfAssessmentForm as id } from '@/i18n/id/self-assessment-form';

// Formulir penilaian mandiri (docs/01 M4), dibawa dari v1 src/app/sa/[token]/self-assessment-form.tsx: satu
// karakteristik per layar, draf disimpan ke server setiap kali berpindah layar, lalu dikirim sekali setelah semua
// karakteristik lengkap. Pernyataan tampil tanpa nomor tingkat. Paket ini tidak memuat kode konsol.

type Lang = 'id' | 'en';
type Text = { id: string; en: string | null };
type Tree = { [key: string]: string | Tree };
type Answer = { statementId: string | null; justification: string; evidenceIds: string[] };
type Characteristic = { id: string; code: string; name: Text; statements: { id: string; text: Text }[]; answer: Answer };

export type FormData = {
    organization: string;
    profile: { name: string; position: string };
    status: 'DRAFT' | 'SUBMITTED';
    submittedAt: string | null;
    minLength: number;
    maxLength: number;
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
        const result = await call(data.answerUrl, 'PUT', { characteristicId: current.id, ...answer });
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
        setIndex(next);
        window.scrollTo({ top: 0 });
    };

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

    const update = (patch: Partial<Answer>) => {
        if (!current) {
            return;
        }
        setAnswers((s) => ({ ...s, [current.id]: { ...(s[current.id] as Answer), ...patch } }));
        setNotice(null);
    };

    return (
        <div className="sv-page">
            {header}
            <main className="sv-main">
                <div className="sv-stack">
                    <p className="sv-eyebrow">{data.organization}</p>
                    {error ? (
                        <p role="alert" className="sv-alert" data-testid="sa-error">
                            {t(`errors.${error}`)}
                        </p>
                    ) : null}
                    {notice ? (
                        <p role="status" className="sv-ok" data-testid="sa-notice">
                            {notice}
                        </p>
                    ) : null}

                    {index === -1 ? (
                        <>
                            <h1>{t('heading')}</h1>
                            <section className="sv-identified" data-testid="sa-identified">
                                <h2>{t('identified.title')}</h2>
                                <p>{t('identified.body')}</p>
                                <p className="sv-muted">{t('identified.access')}</p>
                            </section>
                            <form
                                className="sv-stack"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setError(null);
                                    setBusy(true);
                                    const result = await call(data.profileUrl, 'PUT', profile);
                                    setBusy(false);
                                    if (result.ok) {
                                        setNotice(t('profile.saved'));
                                    } else {
                                        setError(result.error ?? 'INVALID_INPUT');
                                    }
                                }}
                            >
                                <h2>{t('profile.title')}</h2>
                                <label className="sv-field">
                                    <span>{t('profile.name')}</span>
                                    <input
                                        className="sv-input"
                                        value={profile.name}
                                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
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
                                        required
                                        minLength={2}
                                        maxLength={200}
                                    />
                                </label>
                                <button type="submit" className="sv-button sv-secondary" disabled={busy}>
                                    {t('profile.save')}
                                </button>
                                <button
                                    type="button"
                                    className="sv-button sv-primary"
                                    onClick={() => void goTo(0)}
                                    disabled={busy}
                                    data-testid="sa-start"
                                >
                                    {t('start')}
                                </button>
                            </form>
                        </>
                    ) : null}

                    {current ? (
                        <CharacteristicStep
                            key={current.id}
                            t={t}
                            lang={lang}
                            characteristic={current}
                            characteristics={data.characteristics}
                            position={index + 1}
                            total={total}
                            minLength={data.minLength}
                            maxLength={data.maxLength}
                            answer={answers[current.id] as Answer}
                            onChange={update}
                            onJump={(i) => void goTo(i)}
                        />
                    ) : null}

                    {current ? (
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
                                onClick={() => void goTo(index + 1)}
                                disabled={busy}
                                data-testid="sa-next"
                            >
                                {busy ? t('nav.saving') : index + 1 < total ? t('nav.saveNext') : t('nav.saveReview')}
                            </button>
                        </div>
                    ) : null}

                    {index === total ? (
                        <section className="sv-stack" data-testid="sa-review">
                            <h1>{t('review.title')}</h1>
                            {missing.length === 0 ? (
                                <p className="sv-ok">{t('review.complete')}</p>
                            ) : (
                                <>
                                    <p className="sv-alert" data-testid="sa-missing" data-count={missing.length}>
                                        {t('review.incomplete', { count: missing.length })}
                                    </p>
                                    <ul className="sv-list">
                                        {missing.map((m) => (
                                            <li key={m.characteristic.id}>
                                                <span className="sv-strong">
                                                    {m.characteristic.code} {pick(m.characteristic.name, lang)}:
                                                </span>{' '}
                                                {m.reasons
                                                    .map((r) => t(`review.reasons.${r}`, { min: data.minLength }))
                                                    .join(', ')}{' '}
                                                <button
                                                    type="button"
                                                    className="sv-link sv-inline"
                                                    onClick={() => void goTo(data.characteristics.indexOf(m.characteristic))}
                                                >
                                                    {t('review.edit')}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            <p>{t('review.warning')}</p>
                            <button
                                type="button"
                                className="sv-button sv-primary"
                                disabled={busy || missing.length > 0}
                                data-testid="sa-submit"
                                onClick={async () => {
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
                                }}
                            >
                                {busy ? t('review.submitting') : t('review.submit')}
                            </button>
                            <button
                                type="button"
                                className="sv-button sv-secondary"
                                onClick={() => void goTo(total - 1)}
                                disabled={busy}
                            >
                                {t('nav.previous')}
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
    characteristics,
    position,
    total,
    minLength,
    maxLength,
    answer,
    onChange,
    onJump,
}: {
    t: ReturnType<typeof translator>;
    lang: Lang;
    characteristic: Characteristic;
    characteristics: Characteristic[];
    position: number;
    total: number;
    minLength: number;
    maxLength: number;
    answer: Answer;
    onChange: (patch: Partial<Answer>) => void;
    onJump: (index: number) => void;
}) {
    const count = length(answer.justification);
    return (
        <div className="sv-stack" data-testid="sa-characteristic" data-code={characteristic.code}>
            <label className="sv-field">
                <span>{t('jump')}</span>
                <select className="sv-input" value={position - 1} onChange={(e) => onJump(Number(e.target.value))}>
                    {characteristics.map((c, i) => (
                        <option key={c.id} value={i}>
                            {c.code} {pick(c.name, lang)}
                        </option>
                    ))}
                </select>
            </label>
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
            <section className="sv-stack">
                <h2>{t('characteristic.evidence')}</h2>
                <p className="sv-muted">{t('characteristic.noEvidenceUploaded')}</p>
            </section>
        </div>
    );
}
