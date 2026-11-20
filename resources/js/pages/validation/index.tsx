import { Link, router, useForm, usePage } from '@inertiajs/react';
import { CalendarClock, ChevronDown, Download, MapPin, Plus, Video } from 'lucide-react';
import { useState } from 'react';
import ValidationController from '@/actions/App/Http/Controllers/Validation/ValidationController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, Panel, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { SessionFields, emptySession, sessionPayload } from '@/components/nscas/session-fields';
import type { Reference, SessionData, SessionStatus } from '@/components/nscas/session-fields';

type Session = {
    id: string;
    type: string;
    label: string;
    layer: string;
    status: SessionStatus;
    scheduledAt: string | null;
    meetingUrl: string | null;
    location: string | null;
    participantCount: number | null;
    unit: string | null;
    stratum: string | null;
    focusCount: number;
    participants: number;
    ratings: number;
};
type Proposal = {
    sessions: unknown[];
    interviews: number;
    focusGroupParticipants: number;
    siteVisits: number;
    virtualVisits: number;
    focus: { characteristicId: string; code: string; reasons: string[] }[];
};
type Guide = { layer: string; intro: string; questions: { code: string; question: string }[] };
type Props = CollectionCommon &
    Reference & {
        canPlan: boolean;
        canLead: boolean;
        canFeedback: boolean;
        canExport: boolean;
        sessions: Session[];
        proposal: Proposal | null;
        guides: Guide[];
        feedback: { date: string; summary: string; author: string | null }[];
    };

const STATUS_STYLE: Record<SessionStatus, string> = {
    SCHEDULED: 'bg-gold/15 text-gold-deep',
    COMPLETED: 'bg-success/10 text-success',
    CANCELLED: 'bg-muted text-muted-foreground',
};

/** Validasi lapangan: usulan, sesi, panduan, dan umpan balik harian (docs/01 M7). */
export default function ValidationIndex(props: Props) {
    const t = useT();
    const assessment = props.assessment.id;
    const [adding, setAdding] = useState(false);
    const [filter, setFilter] = useState<SessionStatus | 'ALL'>('ALL');
    const shown = filter === 'ALL' ? props.sessions : props.sessions.filter((s) => s.status === filter);
    const completed = props.sessions.filter((s) => s.status === 'COMPLETED').length;
    const active = props.sessions.filter((s) => s.status !== 'CANCELLED').length;
    const errors = usePage<{ errors: Record<string, string | undefined> }>().props.errors;

    return (
        <CollectionShell
            module="validation"
            common={props}
            canEdit={props.canPlan}
            showWindow={false}
            notice={props.canPlan ? null : t('validation.closed')}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('validation.intro')}</p>
                {props.canExport ? (
                    <Button asChild variant="outline" size="sm">
                        <a
                            href={ValidationController.export.url(props.assessment.id)}
                            title={t('validation.exportHint')}
                            data-testid="validation-export"
                        >
                            <Download aria-hidden />
                            {t('validation.exportData')}
                        </a>
                    </Button>
                ) : null}
            </div>
            <FormError message={errors.form} />

            {props.sessions.length === 0 && props.canPlan ? (
                <ProposalPanel proposal={props.proposal} canLead={props.canLead} assessment={assessment} />
            ) : null}

            <Panel title={t('validation.sessions.title')}>
                {props.canPlan ? (
                    <div>
                        <Button variant="outline" onClick={() => setAdding(true)} data-testid="session-add">
                            <Plus aria-hidden />
                            {t('validation.sessions.add')}
                        </Button>
                    </div>
                ) : null}
                {props.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('validation.sessions.empty')}</p>
                ) : (
                    <div className="flex flex-wrap items-center gap-2" data-testid="session-filter">
                        <p className="mr-2 text-sm text-charcoal">
                            {t('validation.sessions.progress', { count: completed, total: active })}
                        </p>
                        {(['ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map((key) => (
                            <button
                                key={key}
                                type="button"
                                aria-pressed={filter === key}
                                onClick={() => setFilter(key)}
                                className={cn(
                                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                    filter === key
                                        ? 'border-maroon bg-maroon text-parchment'
                                        : 'border-border text-foreground hover:bg-muted',
                                )}
                            >
                                {key === 'ALL' ? t('validation.sessions.all') : t(`validation.statuses.${key}`)}
                            </button>
                        ))}
                    </div>
                )}
                {props.sessions.length === 0 ? null : (
                    <ul className="divide-y divide-border rounded-lg border border-border" data-testid="session-list">
                        {shown.map((s) => (
                            <SessionRow key={s.id} session={s} assessment={assessment} />
                        ))}
                    </ul>
                )}
            </Panel>

            <GuidesPanel guides={props.guides} canLead={props.canLead} assessment={assessment} />

            <FeedbackPanel feedback={props.feedback} canEdit={props.canFeedback} assessment={assessment} />

            {adding ? <AddSessionDialog {...props} onClose={() => setAdding(false)} /> : null}
        </CollectionShell>
    );
}

function ProposalPanel({ proposal, canLead, assessment }: { proposal: Proposal | null; canLead: boolean; assessment: string }) {
    const t = useT();
    const locale = useLocale();
    const [busy, setBusy] = useState(false);
    if (proposal === null) {
        return (
            <Panel title={t('validation.proposal.title')}>
                <p className="text-sm text-muted-foreground">{t('validation.proposal.missing')}</p>
            </Panel>
        );
    }
    const tiles = [
        ['interviews', proposal.interviews],
        ['focusGroups', proposal.focusGroupParticipants],
        ['siteVisits', proposal.siteVisits],
        ['virtualVisits', proposal.virtualVisits],
    ] as const;
    return (
        <Panel title={t('validation.proposal.title')} hint={t('validation.proposal.hint')} className="border-gold/60">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="proposal">
                {tiles.map(([key, value]) => (
                    <div key={key} className="frame-hairline min-w-0 rounded-lg px-3 py-3">
                        <dt className="text-xs text-muted-foreground">{t(`validation.proposal.${key}`)}</dt>
                        <dd className="numeral mt-1 font-display text-2xl text-ink">{formatNumber(value, locale)}</dd>
                    </div>
                ))}
            </dl>
            {proposal.focus.length > 0 ? (
                <p className="text-sm text-charcoal">
                    <span className="font-medium text-ink">{t('validation.proposal.focus')}:</span>{' '}
                    {proposal.focus.map((f) => f.code).join(', ')}
                </p>
            ) : null}
            {canLead ? (
                <Button
                    disabled={busy}
                    data-testid="proposal-create"
                    onClick={() => {
                        setBusy(true);
                        router.post(
                            ValidationController.propose.url(assessment),
                            {},
                            { preserveScroll: true, onFinish: () => setBusy(false) },
                        );
                    }}
                >
                    {t('validation.proposal.create')}
                </Button>
            ) : (
                <p className="text-sm text-muted-foreground">{t('validation.proposal.leadOnly')}</p>
            )}
        </Panel>
    );
}

function SessionRow({ session: s, assessment }: { session: Session; assessment: string }) {
    const t = useT();
    const locale = useLocale();
    return (
        <li>
            <Link
                href={ValidationController.show.url({ assessment, session: s.id })}
                className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-4"
                data-testid="session-row"
            >
                <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium text-ink">{s.label}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{t(`validation.types.${s.type}`)}</span>
                        <span className="inline-flex items-center gap-1">
                            <CalendarClock aria-hidden className="size-3.5" />
                            {s.scheduledAt ? formatWib(s.scheduledAt, locale) : t('validation.sessions.unscheduled')}
                        </span>
                        {s.meetingUrl ? (
                            <span className="inline-flex items-center gap-1">
                                <Video aria-hidden className="size-3.5" />
                                {t('validation.sessions.online')}
                            </span>
                        ) : null}
                        {s.location ? (
                            <span className="inline-flex min-w-0 items-center gap-1">
                                <MapPin aria-hidden className="size-3.5 shrink-0" />
                                <span className="truncate">{s.location}</span>
                            </span>
                        ) : null}
                    </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal">
                    <span>{t('validation.sessions.focus', { count: s.focusCount })}</span>
                    <span>{t('validation.sessions.participants', { count: s.participants })}</span>
                    <span>{t('validation.sessions.ratings', { count: s.ratings })}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 font-semibold', STATUS_STYLE[s.status])}>
                        {t(`validation.statuses.${s.status}`)}
                    </span>
                </span>
            </Link>
        </li>
    );
}

function AddSessionDialog(props: Props & { onClose: () => void }) {
    const t = useT();
    const form = useForm<SessionData>(emptySession());
    return (
        <Dialog open onOpenChange={(open) => (open ? null : props.onClose())}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('validation.form.title')}</DialogTitle>
                    <DialogDescription className="sr-only">{t('validation.intro')}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.transform((data) => sessionPayload(data) as SessionData);
                        form.post(ValidationController.store.url(props.assessment.id));
                    }}
                >
                    <SessionFields form={form} reference={props} withType />
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={props.onClose}>
                            {t('validation.form.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing} data-testid="session-create">
                            {t('validation.form.create')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function GuidesPanel({ guides, canLead, assessment }: { guides: Guide[]; canLead: boolean; assessment: string }) {
    const t = useT();
    const [open, setOpen] = useState<string | null>(null);
    return (
        <Panel title={t('validation.guides.title')} hint={t('validation.guides.hint')}>
            <ul className="divide-y divide-border rounded-lg border border-border" data-testid="guides">
                {guides.map((g) => {
                    const expanded = open === g.layer;
                    return (
                        <li key={g.layer}>
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                                aria-expanded={expanded}
                                onClick={() => setOpen(expanded ? null : g.layer)}
                            >
                                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{t(`groupsShort.${g.layer}`)}</span>
                                <span className="text-xs text-muted-foreground">
                                    {t('validation.guides.questions', { count: g.questions.length })}
                                </span>
                                <ChevronDown
                                    aria-hidden
                                    className={cn(
                                        'size-4 shrink-0 text-muted-foreground transition-transform',
                                        expanded && 'rotate-180',
                                    )}
                                />
                            </button>
                            {expanded ? <GuideBody guide={g} canLead={canLead} assessment={assessment} /> : null}
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}

function GuideBody({ guide, canLead, assessment }: { guide: Guide; canLead: boolean; assessment: string }) {
    const t = useT();
    const [editing, setEditing] = useState(false);
    const form = useForm({ intro: guide.intro, questions: guide.questions });
    if (!editing) {
        return (
            <div className="space-y-3 px-4 pb-4">
                <p className="text-sm whitespace-pre-line text-charcoal">{guide.intro}</p>
                <ol className="space-y-2 text-sm">
                    {guide.questions.map((q) => (
                        <li key={q.code} className="flex gap-3">
                            <span className="numeral w-12 shrink-0 font-medium text-gold-deep">{q.code}</span>
                            <span className="min-w-0 text-ink">{q.question}</span>
                        </li>
                    ))}
                </ol>
                {canLead ? (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        {t('validation.guides.edit')}
                    </Button>
                ) : null}
            </div>
        );
    }
    return (
        <form
            className="space-y-4 px-4 pb-4"
            onSubmit={(e) => {
                e.preventDefault();
                form.put(ValidationController.guide.url({ assessment, layer: guide.layer }), {
                    preserveScroll: true,
                    onSuccess: () => setEditing(false),
                });
            }}
        >
            <Field id={`guide-intro-${guide.layer}`} label={t('validation.guides.intro')} error={form.errors.intro}>
                <TextArea
                    id={`guide-intro-${guide.layer}`}
                    rows={4}
                    required
                    minLength={10}
                    maxLength={4000}
                    value={form.data.intro}
                    onChange={(e) => form.setData('intro', e.target.value)}
                />
            </Field>
            {form.data.questions.map((q, i) => (
                <Field key={q.code} id={`guide-${guide.layer}-${q.code}`} label={q.code}>
                    <TextArea
                        id={`guide-${guide.layer}-${q.code}`}
                        rows={2}
                        required
                        minLength={5}
                        maxLength={1000}
                        value={q.question}
                        onChange={(e) =>
                            form.setData(
                                'questions',
                                form.data.questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)),
                            )
                        }
                    />
                </Field>
            ))}
            <FormError message={form.errors.questions} />
            <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={form.processing}>
                    {t('validation.guides.save')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    {t('validation.guides.cancel')}
                </Button>
            </div>
        </form>
    );
}

function todayWib(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function FeedbackPanel({
    feedback,
    canEdit,
    assessment,
}: {
    feedback: { date: string; summary: string; author: string | null }[];
    canEdit: boolean;
    assessment: string;
}) {
    const t = useT();
    const locale = useLocale();
    const today = todayWib();
    const form = useForm({ date: today, summary: feedback.find((f) => f.date === today)?.summary ?? '' });
    const dateLabel = (value: string) =>
        new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(`${value}T00:00:00Z`));
    return (
        <Panel title={t('validation.feedback.title')} hint={t('validation.feedback.hint')}>
            {canEdit ? (
                <form
                    className="space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.put(ValidationController.feedback.url(assessment), { preserveScroll: true });
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                        <Field id="feedback-date" label={t('validation.feedback.date')} error={form.errors.date}>
                            <Input
                                id="feedback-date"
                                type="date"
                                required
                                max={today}
                                value={form.data.date}
                                onChange={(e) => {
                                    const date = e.target.value;
                                    form.setData({ date, summary: feedback.find((f) => f.date === date)?.summary ?? '' });
                                }}
                            />
                        </Field>
                        <Field id="feedback-summary" label={t('validation.feedback.summary')} error={form.errors.summary}>
                            <TextArea
                                id="feedback-summary"
                                rows={3}
                                required
                                minLength={10}
                                maxLength={4000}
                                value={form.data.summary}
                                onChange={(e) => form.setData('summary', e.target.value)}
                            />
                        </Field>
                    </div>
                    <Button type="submit" size="sm" disabled={form.processing}>
                        {t('validation.feedback.save')}
                    </Button>
                </form>
            ) : null}
            {feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('validation.feedback.empty')}</p>
            ) : (
                <ul className="space-y-3" data-testid="feedback-list">
                    {feedback.map((f) => (
                        <li key={f.date} className="border-l-2 border-gold/60 pl-3">
                            <p className="text-xs text-muted-foreground">
                                {dateLabel(f.date)}
                                {f.author ? ` ${t('validation.feedback.by', { name: f.author })}` : ''}
                            </p>
                            <p className="text-sm whitespace-pre-line text-ink">{f.summary}</p>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
