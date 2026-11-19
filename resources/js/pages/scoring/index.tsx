import { Link, router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, BadgeCheck, ChevronDown, ChevronRight, Play } from 'lucide-react';
import { useState } from 'react';
import ScoringController from '@/actions/App/Http/Controllers/Scoring/ScoringController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, Panel, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Row = {
    id: string;
    code: string;
    name: string;
    nameEn: string | null;
    aspectCode: string;
    contextual: boolean;
    mine: number | null;
    assessors: number;
    reconcile: boolean;
    evidence: number;
    reviewed: boolean;
};
type Step = { percent: number; justification: string } | null;
type SclAspect = { code: string; name: string; steps: Record<string, Step> };
type Run = {
    id: string;
    createdAt: string;
    engineVersion: string;
    final: boolean;
    by: string | null;
    index: number | null;
    level: number | null;
};
type Props = CollectionCommon & {
    canRate: boolean;
    canRun: boolean;
    isLead: boolean;
    rows: Row[];
    scl: SclAspect[];
    runs: Run[];
    stale: boolean;
};

/** Penilaian asesor: nilai bukti per karakteristik, jalur setara, dan perhitungan nilai (docs/01 M8). */
export default function ScoringIndex(props: Props) {
    const t = useT();
    const locale = useLocale();
    const assessment = props.assessment.id;
    const errors = usePage<{ errors: Record<string, string | undefined> }>().props.errors;
    const mine = props.rows.filter((r) => r.mine !== null).length;
    const two = props.rows.filter((r) => r.assessors >= 2).length;
    const reconcile = props.rows.filter((r) => r.reconcile).length;
    const [busy, setBusy] = useState(false);

    return (
        <CollectionShell
            module="scoring"
            common={props}
            canEdit={props.canRate}
            showWindow={false}
            notice={props.canRate ? null : t('scoring.closed')}
        >
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('scoring.intro')}</p>
            <FormError message={errors.form} />

            <dl className="grid grid-cols-3 gap-3 sm:max-w-2xl" data-testid="scoring-summary">
                {(
                    [
                        ['mine', mine],
                        ['twoAssessors', two],
                        ['reconcile', reconcile],
                    ] as const
                ).map(([key, value]) => (
                    <div key={key} className="frame-hairline min-w-0 rounded-lg px-3 py-3 sm:px-4">
                        <dt className="text-xs text-muted-foreground">{t(`scoring.summary.${key}`)}</dt>
                        <dd className="numeral mt-1 font-display text-2xl text-ink">
                            {key === 'reconcile'
                                ? value
                                : t('evidence.summary.ofTotal', { count: value, total: props.rows.length })}
                        </dd>
                    </div>
                ))}
            </dl>

            <ul className="divide-y divide-border rounded-lg border border-border" data-testid="scoring-list">
                {props.rows.map((r) => (
                    <li key={r.id}>
                        <Link
                            href={ScoringController.show.url({ assessment, code: r.code })}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60"
                            data-code={r.code}
                        >
                            <span className="min-w-0 flex-1 space-y-1">
                                <span className="block text-sm text-ink">
                                    <span className="font-medium">{r.code}</span>{' '}
                                    {locale === 'en' && r.nameEn ? r.nameEn : r.name}
                                    {r.contextual ? (
                                        <span className="ml-1 text-xs text-muted-foreground">
                                            ({t('scoring.table.contextual')})
                                        </span>
                                    ) : null}
                                </span>
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span>
                                        {t('scoring.table.assessors')}: {r.assessors}
                                    </span>
                                    <span>
                                        {t('scoring.table.evidence')}: {r.evidence}
                                    </span>
                                    {r.reviewed ? (
                                        <span className="inline-flex items-center gap-1 text-success">
                                            <BadgeCheck aria-hidden className="size-3.5" />
                                            {t('scoring.table.reviewed')}
                                        </span>
                                    ) : null}
                                    {r.reconcile ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-gold-deep">
                                            <AlertTriangle aria-hidden className="size-3.5" />
                                            {t('scoring.table.reconcile')}
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                            <span
                                className={cn(
                                    'numeral shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                    r.mine === null ? 'bg-muted text-muted-foreground' : 'bg-success/10 text-success',
                                )}
                                title={t('scoring.table.mine')}
                            >
                                {r.mine === null ? t('scoring.table.notRated') : formatNumber(r.mine, locale, 1)}
                            </span>
                            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                    </li>
                ))}
            </ul>

            {props.isLead && props.scl.length > 0 ? (
                <SclPanel scl={props.scl} canEdit={props.canRate} assessment={assessment} />
            ) : null}

            <Panel title={t('scoring.runs.title')} hint={t('scoring.runs.hint')}>
                {props.stale ? (
                    <p role="note" className="flex items-start gap-2 text-sm text-gold-deep">
                        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                        {t('scoring.runs.stale')}
                    </p>
                ) : null}
                {props.canRun ? (
                    <div>
                        <Button
                            disabled={busy}
                            data-testid="score-run"
                            onClick={() => {
                                setBusy(true);
                                router.post(
                                    ScoringController.run.url(assessment),
                                    {},
                                    { preserveScroll: true, onFinish: () => setBusy(false) },
                                );
                            }}
                        >
                            <Play aria-hidden />
                            {t('scoring.runs.run')}
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">{t('scoring.runs.leadOnly')}</p>
                )}
                {props.runs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('scoring.runs.empty')}</p>
                ) : (
                    <ul className="space-y-2" data-testid="score-runs">
                        {props.runs.map((run) => (
                            <li key={run.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                                <span className="text-ink">{formatWib(run.createdAt, locale)}</span>
                                <span className="numeral text-charcoal">
                                    {run.index === null
                                        ? ''
                                        : t('scoring.runs.index', { value: formatNumber(run.index, locale, 2) })}
                                    {run.level === null ? '' : `, ${t('scoring.runs.level', { value: run.level })}`}
                                </span>
                                {run.by ? (
                                    <span className="text-xs text-muted-foreground">
                                        {t('scoring.runs.by', { name: run.by })}
                                    </span>
                                ) : null}
                                {run.final ? (
                                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                                        {t('scoring.runs.final')}
                                    </span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </CollectionShell>
    );
}

function SclPanel({ scl, canEdit, assessment }: { scl: SclAspect[]; canEdit: boolean; assessment: string }) {
    const t = useT();
    const [open, setOpen] = useState<string | null>(null);
    return (
        <Panel title={t('scoring.scl.title')} hint={t('scoring.scl.hint')}>
            <ul className="divide-y divide-border rounded-lg border border-border" data-testid="scl">
                {scl.map((a) => {
                    const complete = [2, 3, 4, 5].every((s) => a.steps[String(s)]);
                    const expanded = open === a.code;
                    return (
                        <li key={a.code}>
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                                aria-expanded={expanded}
                                onClick={() => setOpen(expanded ? null : a.code)}
                            >
                                <span className="min-w-0 flex-1 text-sm text-ink">
                                    <span className="font-medium">{a.code}</span> {a.name}
                                </span>
                                <span
                                    className={cn(
                                        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                        complete ? 'bg-success/10 text-success' : 'bg-gold/15 text-gold-deep',
                                    )}
                                >
                                    {complete ? t('scoring.scl.complete') : t('scoring.scl.incomplete')}
                                </span>
                                <ChevronDown
                                    aria-hidden
                                    className={cn(
                                        'size-4 shrink-0 text-muted-foreground transition-transform',
                                        expanded && 'rotate-180',
                                    )}
                                />
                            </button>
                            {expanded ? <SclForm aspect={a} canEdit={canEdit} assessment={assessment} /> : null}
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}

function SclForm({ aspect, canEdit, assessment }: { aspect: SclAspect; canEdit: boolean; assessment: string }) {
    const t = useT();
    const form = useForm({
        entries: [2, 3, 4, 5].map((step) => ({
            step,
            percent: aspect.steps[String(step)] ? String(aspect.steps[String(step)]?.percent) : '',
            justification: aspect.steps[String(step)]?.justification ?? '',
        })),
    });
    const errors = form.errors as Record<string, string | undefined>;
    const set = (i: number, key: 'percent' | 'justification', value: string) =>
        form.setData(
            'entries',
            form.data.entries.map((e, j) => (j === i ? { ...e, [key]: value } : e)),
        );
    return (
        <form
            className="space-y-4 px-4 pb-4"
            onSubmit={(e) => {
                e.preventDefault();
                form.transform((data) => ({ entries: data.entries.map((x) => ({ ...x, percent: Number(x.percent) })) }));
                form.put(ScoringController.scl.url({ assessment, aspect: aspect.code }), { preserveScroll: true });
            }}
        >
            {form.data.entries.map((entry, i) => (
                <div key={entry.step} className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <Field
                        id={`scl-${aspect.code}-${entry.step}`}
                        label={t('scoring.scl.step', { step: entry.step })}
                        error={errors[`entries.${i}.percent`]}
                    >
                        <Input
                            id={`scl-${aspect.code}-${entry.step}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="0.01"
                            required
                            disabled={!canEdit}
                            aria-label={`${t('scoring.scl.percent')} ${t('scoring.scl.step', { step: entry.step })}`}
                            value={entry.percent}
                            onChange={(e) => set(i, 'percent', e.target.value)}
                        />
                    </Field>
                    <Field
                        id={`scl-j-${aspect.code}-${entry.step}`}
                        label={t('scoring.scl.justification')}
                        error={errors[`entries.${i}.justification`]}
                    >
                        <TextArea
                            id={`scl-j-${aspect.code}-${entry.step}`}
                            rows={2}
                            required
                            minLength={10}
                            maxLength={2000}
                            disabled={!canEdit}
                            value={entry.justification}
                            onChange={(e) => set(i, 'justification', e.target.value)}
                        />
                    </Field>
                </div>
            ))}
            <FormError message={errors.entries ?? errors.aspectCode} />
            {canEdit ? (
                <Button type="submit" size="sm" disabled={form.processing}>
                    {t('scoring.scl.save')}
                </Button>
            ) : null}
        </form>
    );
}
