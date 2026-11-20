import { Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, Printer, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import ValidationController from '@/actions/App/Http/Controllers/Validation/ValidationController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { SessionFields, sessionPayload, toWibInput } from '@/components/nscas/session-fields';
import type { Reference, SessionData, SessionStatus } from '@/components/nscas/session-fields';
import { Field, FormError, NativeSelect, Panel, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Detail = {
    id: string;
    type: string;
    label: string;
    layer: string;
    status: SessionStatus;
    unitId: string | null;
    stratumId: string | null;
    unit: string | null;
    stratum: string | null;
    scheduledAt: string | null;
    meetingUrl: string | null;
    location: string | null;
    participantCount: number | null;
    focus: string[];
    recordingConsent: boolean;
    notes: string | null;
    raters: number;
    participants: { id: string; name: string; position: string }[];
    guide: { intro: string; questions: { code: string; question: string }[] } | null;
    ratings: Record<string, { level: number; note: string | null; evidence: string | null; agreement: string | null }>;
    fieldGuide: FieldGuide | null;
    siteChecks: Record<string, { result: string; note: string | null }>;
};
type SiteItem = { code: string; characteristic: string; text: string };
type FieldGuide =
    | {
          kind: 'INTERVIEW';
          opening: string[];
          closing: string[];
          characteristics: Record<string, { probes: string[]; strong: string; weak: string }>;
      }
    | {
          kind: 'FOCUS_GROUP';
          rules: string[];
          opening: string[];
          warmUp: string;
          closing: string[];
          characteristics: Record<string, { probes: string[] }>;
      }
    | {
          kind: 'SITE_VISIT';
          intro: string;
          sections: { code: string; title: string; method: string; items: SiteItem[] }[];
      };

const EVIDENCE = ['CONSISTENT', 'PARTIAL', 'NONE'];
const AGREEMENT = ['AGREED', 'MIXED', 'DIVIDED'];
const SITE_RESULTS = ['MEETS', 'PARTIAL', 'NOT_MET', 'NOT_OBSERVED'];
type Props = CollectionCommon &
    Reference & {
        session: Detail;
        canPlan: boolean;
        canRate: boolean;
        ratingLevels: number[];
        maxFocusGroup: number;
    };

const STATUS_STYLE: Record<SessionStatus, string> = {
    SCHEDULED: 'bg-gold/15 text-gold-deep',
    COMPLETED: 'bg-success/10 text-success',
    CANCELLED: 'bg-muted text-muted-foreground',
};

/** Rincian satu sesi validasi: jadwal, narasumber, pertanyaan panduan, serta catatan dan nilai asesor. */
export default function ValidationSession(props: Props) {
    const t = useT();
    const locale = useLocale();
    const s = props.session;
    const assessment = props.assessment.id;
    const errors = usePage<{ errors: Record<string, string | undefined> }>().props.errors;

    return (
        <CollectionShell
            module="validation"
            common={props}
            canEdit={props.canPlan}
            showWindow={false}
            notice={props.canRate ? null : t('validation.session.assessor.closed')}
        >
            <div className="space-y-3">
                <Link
                    href={ValidationController.index.url(assessment)}
                    className="inline-flex items-center gap-1.5 text-sm text-charcoal hover:text-ink"
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    {t('validation.session.back')}
                </Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3 className="min-w-0 font-display text-2xl leading-tight text-ink" data-testid="session-title">
                        {s.label}
                    </h3>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[s.status])}>
                        {t(`validation.statuses.${s.status}`)}
                    </span>
                </div>
                <p className="text-sm text-charcoal">
                    {t(`validation.types.${s.type}`)}
                    {s.scheduledAt ? `, ${formatWib(s.scheduledAt, locale)} WIB` : ''}
                    {s.location ? `, ${s.location}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                    {s.meetingUrl ? (
                        <Button asChild variant="outline" size="sm">
                            <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink aria-hidden />
                                {t('validation.session.openMeeting')}
                            </a>
                        </Button>
                    ) : null}
                    {s.fieldGuide ? (
                        <Button asChild variant="outline" size="sm">
                            <a
                                href={ValidationController.print.url({ assessment, session: s.id })}
                                target="_blank"
                                rel="noopener"
                                title={t('validation.session.field.printHint')}
                                data-testid="guide-print"
                            >
                                <Printer aria-hidden />
                                {t('validation.session.field.print')}
                            </a>
                        </Button>
                    ) : null}
                </div>
            </div>
            <FormError message={errors.form} />

            {s.fieldGuide?.kind === 'SITE_VISIT' ? <SiteChecklist {...props} guide={s.fieldGuide} /> : null}

            <AssessorForm {...props} />

            <Participants
                session={s}
                canEdit={props.canPlan}
                assessment={assessment}
                max={s.type === 'FOCUS_GROUP' ? props.maxFocusGroup : null}
            />

            {props.canPlan ? <DetailsForm {...props} /> : null}
        </CollectionShell>
    );
}

function AssessorForm(props: Props) {
    const t = useT();
    const locale = useLocale();
    const s = props.session;
    const [showAll, setShowAll] = useState(s.focus.length === 0);
    const questions = useMemo(() => new Map((s.guide?.questions ?? []).map((q) => [q.code, q.question])), [s.guide]);
    const initial = useMemo(
        () =>
            Object.fromEntries(
                props.characteristics.map((c) => [
                    c.id,
                    {
                        level: s.ratings[c.id] ? String(s.ratings[c.id].level) : '',
                        note: s.ratings[c.id]?.note ?? '',
                        evidence: s.ratings[c.id]?.evidence ?? '',
                        agreement: s.ratings[c.id]?.agreement ?? '',
                    },
                ]),
            ),
        [props.characteristics, s.ratings],
    );
    const form = useForm({
        recordingConsent: s.recordingConsent,
        notes: s.notes ?? '',
        ratings: initial as Record<string, { level: string; note: string; evidence: string; agreement: string }>,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const visible = props.characteristics.filter(
        (c) => showAll || s.focus.includes(c.id) || form.data.ratings[c.id]?.level !== '',
    );
    const disabled = !props.canRate;
    const guide = s.fieldGuide;
    const talk = guide && guide.kind !== 'SITE_VISIT' ? guide : null;
    const group = guide?.kind === 'FOCUS_GROUP';

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.transform((data) => ({
                    recordingConsent: data.recordingConsent,
                    notes: data.notes,
                    ratings: Object.entries(data.ratings)
                        .filter(([id, r]) => r.level !== '' || s.ratings[id])
                        .map(([id, r]) => ({
                            characteristicId: id,
                            level: r.level === '' ? null : Number(r.level),
                            note: r.note.trim() === '' ? null : r.note,
                            evidence: r.evidence === '' ? null : r.evidence,
                            agreement: r.agreement === '' ? null : r.agreement,
                        })),
                }));
                form.put(ValidationController.form.url({ assessment: props.assessment.id, session: s.id }), {
                    preserveScroll: true,
                });
            }}
        >
            <Panel title={t('validation.session.assessor.title')} hint={t('validation.session.assessor.hint')}>
                {s.raters > 0 ? (
                    <p className="text-xs text-muted-foreground">
                        {t('validation.session.assessor.raters', { count: s.raters })}
                    </p>
                ) : null}
                {s.guide || talk ? (
                    <details className="rounded-md border border-border px-4 py-2 text-sm" data-testid="guide-flow">
                        <summary className="cursor-pointer font-medium text-ink">
                            {talk ? t('validation.session.field.flowTitle') : t('validation.session.guide')}
                        </summary>
                        {s.guide ? <p className="mt-2 whitespace-pre-line text-charcoal">{s.guide.intro}</p> : null}
                        {talk?.kind === 'FOCUS_GROUP' ? (
                            <GuideList title={t('validation.session.field.rules')} lines={talk.rules} />
                        ) : null}
                        {talk ? <GuideList title={t('validation.session.field.opening')} lines={talk.opening} ordered /> : null}
                        {talk?.kind === 'FOCUS_GROUP' ? (
                            <GuideList title={t('validation.session.field.warmUp')} lines={[talk.warmUp]} />
                        ) : null}
                        {talk ? <GuideList title={t('validation.session.field.closing')} lines={talk.closing} ordered /> : null}
                    </details>
                ) : null}
                <ul className="divide-y divide-border rounded-lg border border-border" data-testid="rating-list">
                    {visible.map((c) => {
                        const value = form.data.ratings[c.id];
                        return (
                            <li key={c.id} className="space-y-2 px-4 py-3" data-code={c.code}>
                                <p className="text-sm">
                                    <span className="font-medium text-ink">{c.code}</span>{' '}
                                    {locale === 'en' && c.nameEn ? c.nameEn : c.name}
                                </p>
                                {questions.get(c.code) ? (
                                    <p className="text-sm text-muted-foreground">{questions.get(c.code)}</p>
                                ) : null}
                                {talk?.characteristics[c.code] ? <Probes item={talk.characteristics[c.code]} /> : null}
                                <div
                                    className={cn(
                                        'grid gap-2 sm:grid-cols-2',
                                        talk &&
                                            (group
                                                ? 'lg:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]'
                                                : 'lg:grid-cols-[8rem_minmax(0,1fr)]'),
                                    )}
                                >
                                    <NativeSelect
                                        aria-label={`${t('validation.session.assessor.rating')} ${c.code}`}
                                        disabled={disabled}
                                        value={value.level}
                                        onChange={(e) =>
                                            form.setData('ratings', {
                                                ...form.data.ratings,
                                                [c.id]: { ...value, level: e.target.value },
                                            })
                                        }
                                    >
                                        <option value="">{t('validation.session.assessor.notRated')}</option>
                                        {props.ratingLevels.map((level) => (
                                            <option key={level} value={String(level)}>
                                                {formatNumber(level, locale, 1)}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                    {talk ? (
                                        <NativeSelect
                                            aria-label={`${t('validation.session.field.evidence')} ${c.code}`}
                                            disabled={disabled}
                                            value={value.evidence}
                                            onChange={(e) =>
                                                form.setData('ratings', {
                                                    ...form.data.ratings,
                                                    [c.id]: { ...value, evidence: e.target.value },
                                                })
                                            }
                                            data-testid="evidence-code"
                                        >
                                            <option value="">
                                                {t('validation.session.field.evidence')}: {t('validation.session.field.notCoded')}
                                            </option>
                                            {EVIDENCE.map((code) => (
                                                <option key={code} value={code}>
                                                    {t(`validation.session.field.evidenceCodes.${code}`)}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    ) : null}
                                    {group ? (
                                        <NativeSelect
                                            aria-label={`${t('validation.session.field.agreement')} ${c.code}`}
                                            disabled={disabled}
                                            value={value.agreement}
                                            onChange={(e) =>
                                                form.setData('ratings', {
                                                    ...form.data.ratings,
                                                    [c.id]: { ...value, agreement: e.target.value },
                                                })
                                            }
                                            data-testid="agreement-code"
                                        >
                                            <option value="">
                                                {t('validation.session.field.agreement')}:{' '}
                                                {t('validation.session.field.notCoded')}
                                            </option>
                                            {AGREEMENT.map((code) => (
                                                <option key={code} value={code}>
                                                    {t(`validation.session.field.agreementCodes.${code}`)}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    ) : null}
                                    <Input
                                        className={talk ? 'sm:col-span-2 lg:col-span-full' : undefined}
                                        aria-label={`${t('validation.session.assessor.ratingNote')} ${c.code}`}
                                        placeholder={t('validation.session.assessor.ratingNote')}
                                        disabled={disabled}
                                        maxLength={2000}
                                        value={value.note}
                                        onChange={(e) =>
                                            form.setData('ratings', {
                                                ...form.data.ratings,
                                                [c.id]: { ...value, note: e.target.value },
                                            })
                                        }
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
                {s.focus.length > 0 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
                        {showAll ? t('validation.session.assessor.showFocus') : t('validation.session.assessor.showAll')}
                    </Button>
                ) : null}
                <Field
                    id="session-notes"
                    label={t('validation.session.assessor.notes')}
                    hint={t('validation.session.assessor.notesHint')}
                    error={errors.notes}
                >
                    <TextArea
                        id="session-notes"
                        rows={5}
                        maxLength={10000}
                        disabled={disabled}
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                    />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        className="size-4 accent-maroon"
                        disabled={disabled}
                        checked={form.data.recordingConsent}
                        onChange={(e) => form.setData('recordingConsent', e.target.checked)}
                    />
                    {t('validation.session.assessor.consent')}
                </label>
                <FormError message={errors.ratings} />
                {props.canRate ? (
                    <Button type="submit" disabled={form.processing} data-testid="rating-save">
                        {t('validation.session.assessor.save')}
                    </Button>
                ) : null}
            </Panel>
        </form>
    );
}

function GuideList({ title, lines, ordered = false }: { title: string; lines: string[]; ordered?: boolean }) {
    const List = ordered ? 'ol' : 'ul';
    return (
        <div className="mt-3 space-y-1">
            <p className="font-medium text-ink">{title}</p>
            <List className={cn('space-y-1 pl-5 text-charcoal', ordered ? 'list-decimal' : 'list-disc')}>
                {lines.map((line, i) => (
                    <li key={i}>{line}</li>
                ))}
            </List>
        </div>
    );
}

/** Pertanyaan pendalaman dan petunjuk penilaian jawaban untuk satu karakteristik. */
function Probes({ item }: { item: { probes: string[]; strong?: string; weak?: string } }) {
    const t = useT();
    return (
        <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-gold-deep select-none">
                {t('validation.session.field.probes')}
            </summary>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-charcoal">
                {item.probes.map((p, i) => (
                    <li key={i}>{p}</li>
                ))}
            </ul>
            {item.strong ? (
                <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <div className="rounded-md bg-success/10 px-2.5 py-1.5">
                        <dt className="font-medium text-success">{t('validation.session.field.strong')}</dt>
                        <dd className="text-charcoal">{item.strong}</dd>
                    </div>
                    <div className="rounded-md bg-gold/10 px-2.5 py-1.5">
                        <dt className="font-medium text-gold-deep">{t('validation.session.field.weak')}</dt>
                        <dd className="text-charcoal">{item.weak}</dd>
                    </div>
                </dl>
            ) : null}
        </details>
    );
}

/** Lembar kerja kunjungan proyek (bahan validasi versi 2): hasil per butir untuk analisis antarproyek. */
function SiteChecklist(props: Props & { guide: Extract<FieldGuide, { kind: 'SITE_VISIT' }> }) {
    const t = useT();
    const locale = useLocale();
    const s = props.session;
    const items = props.guide.sections.flatMap((section) => section.items);
    const form = useForm({
        checks: Object.fromEntries(
            items.map((item) => [
                item.code,
                { result: s.siteChecks[item.code]?.result ?? '', note: s.siteChecks[item.code]?.note ?? '' },
            ]),
        ) as Record<string, { result: string; note: string }>,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const done = Object.values(form.data.checks).filter((c) => c.result !== '').length;
    const disabled = !props.canRate;
    const set = (code: string, patch: Partial<{ result: string; note: string }>) =>
        form.setData('checks', { ...form.data.checks, [code]: { ...form.data.checks[code], ...patch } });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.transform((data) => ({
                    checks: Object.entries(data.checks)
                        .filter(([code, c]) => c.result !== '' || s.siteChecks[code])
                        .map(([code, c]) => ({
                            itemCode: code,
                            result: c.result === '' ? null : c.result,
                            note: c.note.trim() === '' ? null : c.note,
                        })),
                }));
                form.put(ValidationController.siteChecks.url({ assessment: props.assessment.id, session: s.id }), {
                    preserveScroll: true,
                });
            }}
        >
            <Panel title={t('validation.session.field.site.title')} hint={t('validation.session.field.site.hint')}>
                <p className="text-sm font-medium text-charcoal" data-testid="site-progress">
                    {t('validation.session.field.site.progress', {
                        done: formatNumber(done, locale),
                        total: formatNumber(items.length, locale),
                    })}
                </p>
                {props.guide.sections.map((section) => (
                    <section key={section.code} className="space-y-2">
                        <h4 className="text-sm font-semibold text-ink">
                            {section.code}. {section.title}{' '}
                            <span className="font-normal text-muted-foreground">
                                ({t(`validation.session.field.site.methods.${section.method}`)})
                            </span>
                        </h4>
                        <ul className="divide-y divide-border rounded-lg border border-border" data-testid="site-items">
                            {section.items.map((item) => {
                                const value = form.data.checks[item.code];
                                return (
                                    <li key={item.code} className="min-w-0 space-y-2 px-4 py-3" data-code={item.code}>
                                        <p className="text-sm text-ink">
                                            <span className="font-medium">{item.code}</span>{' '}
                                            <span className="text-xs text-muted-foreground">{item.characteristic}</span>
                                            <br />
                                            {item.text}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={item.code}>
                                            {SITE_RESULTS.map((r) => (
                                                <label
                                                    key={r}
                                                    className={cn(
                                                        'cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                                                        value.result === r
                                                            ? 'border-maroon bg-maroon text-parchment'
                                                            : 'border-border text-charcoal hover:bg-muted',
                                                        disabled && 'cursor-not-allowed opacity-60',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        className="sr-only"
                                                        name={`site-${item.code}`}
                                                        value={r}
                                                        disabled={disabled}
                                                        checked={value.result === r}
                                                        onChange={() => set(item.code, { result: r })}
                                                    />
                                                    {t(`validation.session.field.site.results.${r}`)}
                                                </label>
                                            ))}
                                            {value.result !== '' && !disabled ? (
                                                <button
                                                    type="button"
                                                    className="px-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
                                                    onClick={() => set(item.code, { result: '', note: '' })}
                                                >
                                                    {t('validation.session.field.site.clear')}
                                                </button>
                                            ) : null}
                                        </div>
                                        {value.result === 'PARTIAL' || value.result === 'NOT_MET' || value.note !== '' ? (
                                            <Input
                                                aria-label={`${t('validation.session.field.site.note')} ${item.code}`}
                                                placeholder={t('validation.session.field.site.note')}
                                                disabled={disabled}
                                                maxLength={2000}
                                                value={value.note}
                                                onChange={(e) => set(item.code, { note: e.target.value })}
                                            />
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
                <FormError message={errors.checks} />
                {props.canRate ? (
                    <Button type="submit" disabled={form.processing} data-testid="site-save">
                        {t('validation.session.field.site.save')}
                    </Button>
                ) : null}
            </Panel>
        </form>
    );
}

function Participants({
    session,
    canEdit,
    assessment,
    max,
}: {
    session: Detail;
    canEdit: boolean;
    assessment: string;
    max: number | null;
}) {
    const t = useT();
    const form = useForm({ name: '', position: '' });
    const full = max !== null && session.participants.length >= max;
    return (
        <Panel title={t('validation.session.participants.title')} hint={t('validation.session.participants.hint')}>
            {session.participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('validation.session.participants.empty')}</p>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border" data-testid="participants">
                    {session.participants.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="min-w-0 flex-1 text-sm">
                                <span className="font-medium text-ink">{p.name}</span>
                                <span className="block text-xs text-muted-foreground">{p.position}</span>
                            </span>
                            {canEdit ? (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    aria-label={t('validation.session.participants.remove')}
                                    title={t('validation.session.participants.remove')}
                                    onClick={() => {
                                        if (
                                            window.confirm(t('validation.session.participants.confirmRemove', { name: p.name }))
                                        ) {
                                            router.delete(
                                                ValidationController.removeParticipant.url({ assessment, participant: p.id }),
                                                {
                                                    preserveScroll: true,
                                                },
                                            );
                                        }
                                    }}
                                >
                                    <Trash2 aria-hidden />
                                </Button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
            {canEdit && !full ? (
                <form
                    className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(ValidationController.addParticipant.url({ assessment, session: session.id }), {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                >
                    <Field id="participant-name" label={t('validation.session.participants.name')} error={form.errors.name}>
                        <Input
                            id="participant-name"
                            required
                            minLength={2}
                            maxLength={200}
                            autoComplete="off"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                        />
                    </Field>
                    <Field
                        id="participant-position"
                        label={t('validation.session.participants.position')}
                        error={form.errors.position}
                    >
                        <Input
                            id="participant-position"
                            required
                            minLength={2}
                            maxLength={200}
                            autoComplete="off"
                            value={form.data.position}
                            onChange={(e) => form.setData('position', e.target.value)}
                        />
                    </Field>
                    <Button type="submit" variant="outline" disabled={form.processing}>
                        <UserPlus aria-hidden />
                        {t('validation.session.participants.add')}
                    </Button>
                </form>
            ) : null}
            {full ? (
                <p className="text-sm text-muted-foreground">{t('validation.session.participants.full', { max: max ?? 0 })}</p>
            ) : null}
        </Panel>
    );
}

function DetailsForm(props: Props) {
    const t = useT();
    const s = props.session;
    const form = useForm<SessionData>({
        type: s.type,
        label: s.label,
        layer: s.layer,
        unitId: s.unitId ?? '',
        stratumId: s.stratumId ?? '',
        scheduledAt: toWibInput(s.scheduledAt),
        meetingUrl: s.meetingUrl ?? '',
        location: s.location ?? '',
        participantCount: s.participantCount === null ? '' : String(s.participantCount),
        focus: s.focus,
        status: s.status,
    });
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.transform((data) => sessionPayload(data) as SessionData);
                form.put(ValidationController.update.url({ assessment: props.assessment.id, session: s.id }), {
                    preserveScroll: true,
                });
            }}
        >
            <Panel title={t('validation.session.details')}>
                <SessionFields form={form} reference={props} withStatus />
                <Button type="submit" disabled={form.processing} data-testid="session-save">
                    {t('validation.form.save')}
                </Button>
            </Panel>
        </form>
    );
}
