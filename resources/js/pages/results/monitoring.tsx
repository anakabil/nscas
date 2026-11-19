import { router, useForm, usePage } from '@inertiajs/react';
import { BadgeCheck, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import MonitoringController from '@/actions/App/Http/Controllers/Results/MonitoringController';
import { DUE_STYLE, formatDay, quarterLabel } from '@/components/nscas/action-format';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, NativeSelect, Panel, TextArea } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Update = {
    kind: 'PROGRESS' | 'VERIFICATION';
    note: string;
    progress: number;
    status: string;
    by: string | null;
    at: string;
};
type Action = {
    id: string;
    code: string | null;
    title: string;
    ownerName: string;
    ownerPosition: string;
    unit: string | null;
    dueDate: string;
    quarter: string;
    successIndicator: string;
    status: string;
    progress: number;
    dueState: string;
    editable: boolean;
    updates: Update[];
};
type Props = CollectionCommon & {
    canUpdate: boolean;
    canVerify: boolean;
    canReview: boolean;
    open: boolean;
    monitoring: {
        actions: Action[];
        summary: { total: number; verified: number; done: number; overdue: number; dueSoon: number };
        currentQuarter: string;
        reviews: { quarter: string; summary: string; closing: boolean; by: string | null; at: string }[];
    };
};

const UPDATE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

/** Pemantauan rencana aksi (docs/01 M10). */
export default function Monitoring(props: Props) {
    const t = useT();
    const errors = usePage<{ errors: Record<string, string | undefined> }>().props.errors;
    const m = props.monitoring;
    const [filter, setFilter] = useState<'all' | 'attention'>(
        m.summary.overdue + m.summary.dueSoon + m.summary.done > 0 ? 'attention' : 'all',
    );
    const [open, setOpen] = useState<string | null>(null);
    const shown =
        filter === 'all'
            ? m.actions
            : m.actions.filter((a) => a.dueState === 'overdue' || a.dueState === 'dueSoon' || a.status === 'DONE');
    const quarters = Array.from(new Set(shown.map((a) => a.quarter)));

    return (
        <CollectionShell
            module="monitoring"
            common={props}
            canEdit={props.canUpdate}
            showWindow={false}
            notice={props.open ? null : t('monitoringPage.closed')}
        >
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('monitoringPage.intro')}</p>
            <FormError message={errors.form} />
            {m.actions.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="monitoring-empty">
                    {t('monitoringPage.empty')}
                </p>
            ) : (
                <>
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="monitoring-summary">
                        {(['total', 'verified', 'done', 'overdue', 'dueSoon'] as const).map((key) => (
                            <div key={key} className="frame-hairline min-w-0 rounded-lg px-3 py-3">
                                <dt className="text-xs text-muted-foreground">{t(`monitoringPage.summary.${key}`)}</dt>
                                <dd
                                    className={cn(
                                        'numeral mt-1 font-display text-2xl',
                                        key === 'overdue' && m.summary.overdue > 0 ? 'text-destructive' : 'text-ink',
                                    )}
                                >
                                    {m.summary[key]}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <div className="flex flex-wrap gap-2">
                        {(['attention', 'all'] as const).map((key) => (
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
                                {t(`monitoringPage.filter.${key}`)}
                            </button>
                        ))}
                    </div>
                    {quarters.map((q) => (
                        <section key={q} className="space-y-2">
                            <h3 className="text-sm font-semibold text-ink">{quarterLabel(q, t)}</h3>
                            <ul
                                className="divide-y divide-border rounded-lg border border-border"
                                data-testid="monitoring-actions"
                            >
                                {shown
                                    .filter((a) => a.quarter === q)
                                    .map((a) => (
                                        <ActionRow
                                            key={a.id}
                                            action={a}
                                            expanded={open === a.id}
                                            onToggle={() => setOpen(open === a.id ? null : a.id)}
                                            canUpdate={props.canUpdate && a.editable}
                                            canVerify={props.canVerify}
                                            assessment={props.assessment.id}
                                        />
                                    ))}
                            </ul>
                        </section>
                    ))}
                </>
            )}
            <Reviews {...props} />
        </CollectionShell>
    );
}

function ActionRow({
    action: a,
    expanded,
    onToggle,
    canUpdate,
    canVerify,
    assessment,
}: {
    action: Action;
    expanded: boolean;
    onToggle: () => void;
    canUpdate: boolean;
    canVerify: boolean;
    assessment: string;
}) {
    const t = useT();
    const locale = useLocale();
    return (
        <li>
            <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                aria-expanded={expanded}
                onClick={onToggle}
            >
                <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm text-ink">
                        {a.code ? <span className="font-medium">{a.code} </span> : null}
                        {a.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                        {a.ownerName}, {formatDay(a.dueDate, locale)}
                    </span>
                    <span className="block h-1.5 max-w-xs rounded-full bg-muted" aria-hidden>
                        <span className="block h-full rounded-full bg-maroon" style={{ width: `${a.progress}%` }} />
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            a.status === 'DONE' ? DUE_STYLE.dueSoon : DUE_STYLE[a.dueState],
                        )}
                    >
                        {a.status === 'DONE' ? t('monitoringPage.summary.done') : t(`dueStates.${a.dueState}`)}
                    </span>
                    <span className="text-xs text-charcoal">{t(`actionStatuses.${a.status}`)}</span>
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
                />
            </button>
            {expanded ? (
                <div className="space-y-4 px-4 pb-4">
                    <p className="text-xs text-charcoal">{a.successIndicator}</p>
                    {a.updates.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-ink">{t('monitoringPage.history')}</p>
                            <ul className="space-y-2">
                                {a.updates.map((u, i) => (
                                    <li key={i} className="border-l-2 border-gold/60 pl-3 text-sm">
                                        <p className="text-xs text-muted-foreground">
                                            {t(`monitoringPage.kinds.${u.kind}`)}, {formatWib(u.at, locale)}
                                            {u.by ? `, ${u.by}` : ''}, {u.progress}%
                                        </p>
                                        <p className="text-ink">{u.note}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {canUpdate && a.status !== 'VERIFIED' ? <ProgressForm action={a} assessment={assessment} /> : null}
                    {canVerify && a.status === 'DONE' ? <VerifyForm action={a} assessment={assessment} /> : null}
                </div>
            ) : null}
        </li>
    );
}

function ProgressForm({ action, assessment }: { action: Action; assessment: string }) {
    const t = useT();
    const form = useForm({
        note: '',
        progress: String(action.progress),
        status: action.status === 'VERIFIED' ? 'DONE' : action.status,
    });
    return (
        <form
            className="space-y-3 rounded-md bg-muted/40 p-3"
            onSubmit={(e) => {
                e.preventDefault();
                form.transform((data) => ({ ...data, progress: Number(data.progress) }));
                form.post(MonitoringController.progress.url({ assessment, action: action.id }), {
                    preserveScroll: true,
                    onSuccess: () => form.reset('note'),
                });
            }}
        >
            <p className="text-sm font-semibold text-ink">{t('monitoringPage.progress.title')}</p>
            <Field id={`note-${action.id}`} label={t('monitoringPage.progress.note')} error={form.errors.note}>
                <TextArea
                    id={`note-${action.id}`}
                    rows={2}
                    required
                    minLength={10}
                    maxLength={4000}
                    value={form.data.note}
                    onChange={(e) => form.setData('note', e.target.value)}
                />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field id={`pct-${action.id}`} label={t('monitoringPage.progress.percent')} error={form.errors.progress}>
                    <Input
                        id={`pct-${action.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        required
                        value={form.data.progress}
                        onChange={(e) => form.setData('progress', e.target.value)}
                    />
                </Field>
                <Field id={`status-${action.id}`} label={t('monitoringPage.progress.status')} error={form.errors.status}>
                    <NativeSelect
                        id={`status-${action.id}`}
                        value={form.data.status}
                        onChange={(e) => form.setData('status', e.target.value)}
                    >
                        {UPDATE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {t(`actionStatuses.${s}`)}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>
            </div>
            <Button type="submit" size="sm" disabled={form.processing} data-testid="progress-save">
                {t('monitoringPage.progress.save')}
            </Button>
        </form>
    );
}

function VerifyForm({ action, assessment }: { action: Action; assessment: string }) {
    const t = useT();
    const [note, setNote] = useState('');
    const send = (approve: boolean) =>
        router.post(
            MonitoringController.verify.url({ assessment, action: action.id }),
            { approve, note },
            { preserveScroll: true },
        );
    return (
        <div className="space-y-3 rounded-md border border-gold/60 p-3">
            <p className="text-sm font-semibold text-ink">{t('monitoringPage.verify.title')}</p>
            <Field id={`verify-${action.id}`} label={t('monitoringPage.verify.note')}>
                <TextArea
                    id={`verify-${action.id}`}
                    rows={2}
                    minLength={10}
                    maxLength={4000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
            </Field>
            <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={note.trim().length < 10} onClick={() => send(true)} data-testid="verify-approve">
                    <BadgeCheck aria-hidden />
                    {t('monitoringPage.verify.approve')}
                </Button>
                <Button size="sm" variant="outline" disabled={note.trim().length < 10} onClick={() => send(false)}>
                    {t('monitoringPage.verify.reject')}
                </Button>
            </div>
        </div>
    );
}

function Reviews(props: Props) {
    const t = useT();
    const locale = useLocale();
    const m = props.monitoring;
    const existing = m.reviews.find((r) => r.quarter === m.currentQuarter);
    const form = useForm({ quarter: m.currentQuarter, summary: existing?.summary ?? '', closing: existing?.closing ?? false });
    return (
        <Panel title={t('monitoringPage.reviews.title')} hint={t('monitoringPage.reviews.hint')}>
            {props.canReview ? (
                <form
                    className="space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.put(MonitoringController.review.url(props.assessment.id), { preserveScroll: true });
                    }}
                >
                    <p className="text-sm font-medium text-ink">{quarterLabel(m.currentQuarter, t)}</p>
                    <Field id="review-summary" label={t('monitoringPage.reviews.summary')} error={form.errors.summary}>
                        <TextArea
                            id="review-summary"
                            rows={3}
                            required
                            minLength={20}
                            maxLength={4000}
                            value={form.data.summary}
                            onChange={(e) => form.setData('summary', e.target.value)}
                        />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="size-4 accent-maroon"
                            checked={form.data.closing}
                            onChange={(e) => form.setData('closing', e.target.checked)}
                        />
                        {t('monitoringPage.reviews.closing')}
                    </label>
                    <Button type="submit" size="sm" disabled={form.processing} data-testid="review-save">
                        {t('monitoringPage.reviews.save')}
                    </Button>
                </form>
            ) : null}
            {m.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('monitoringPage.reviews.empty')}</p>
            ) : (
                <ul className="space-y-3" data-testid="monitoring-reviews">
                    {m.reviews.map((r) => (
                        <li key={r.quarter} className="border-l-2 border-gold/60 pl-3">
                            <p className="text-xs text-muted-foreground">
                                {quarterLabel(r.quarter, t)}
                                {r.by ? `, ${t('monitoringPage.reviews.by', { name: r.by })}` : ''}, {formatWib(r.at, locale)}
                                {r.closing ? (
                                    <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
                                        {t('monitoringPage.reviews.closingBadge')}
                                    </span>
                                ) : null}
                            </p>
                            <p className="text-sm whitespace-pre-line text-ink">{r.summary}</p>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
