import { router, useForm } from '@inertiajs/react';
import { BadgeCheck, RotateCcw, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import DataQualityController from '@/actions/App/Http/Controllers/Validation/DataQualityController';
import { CollectionShell, formatPercent } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, Panel, TextArea, formatDateTime, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Masked = { value: number | null; suppressed: boolean };
type StratumRow = {
    stratumId: string;
    code: string;
    name: string;
    population: number;
    completed: Masked;
    rate: number | null;
    belowMinimum: boolean;
    justification: string | null;
};
type Review = { note: string | null; by: string | null; at: string } | null;
type Kind = 'PARTICIPATION' | 'DATA_QUALITY';
type Report = {
    minCell: number;
    alphaMin: number;
    rwgMin: number;
    minParticipation: number;
    strata: StratumRow[];
    alpha: { code: string; name: string; alpha: number | null; n: number | null; belowThreshold: boolean }[];
    rwg: { unitId: string; name: string; average: number | null; n: number | null; belowThreshold: boolean }[];
    counts: { analysed: number; excluded: number; flagged: number };
    flagged: {
        id: string;
        flags: string[];
        submittedOn: string | null;
        durationBucket: string;
        excluded: boolean;
        reason: string | null;
    }[];
    reviews: Record<Kind, Review>;
};
type Props = CollectionCommon & { isLead: boolean; canReview: boolean; canExclude: boolean; report: Report };

const FLAGGED_LIMIT = 200;
/** Jawaban bertanda yang ditampilkan sebelum pengguna meminta seluruh daftar. */
const FLAGGED_PREVIEW = 10;

/** Tinjauan mutu data sebelum validasi lapangan (docs/12 temuan T3). */
export default function DataQuality(props: Props) {
    const t = useT();
    const locale = useLocale();
    const r = props.report;
    const lead = props.canReview || props.canExclude;
    const notice = !props.isLead ? t('dataQuality.leadOnly') : !props.canReview ? t('dataQuality.closed') : null;
    const missingJustification = r.strata.some((s) => s.belowMinimum && !s.justification);
    const [allFlagged, setAllFlagged] = useState(false);
    const flagged = allFlagged ? r.flagged : r.flagged.slice(0, FLAGGED_PREVIEW);

    return (
        <CollectionShell module="dataQuality" common={props} canEdit={lead} showWindow={false} notice={notice}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {t('dataQuality.intro', { min: r.minCell })}
            </p>

            <dl className="grid grid-cols-3 gap-3 sm:max-w-2xl" data-testid="quality-counts">
                {(['analysed', 'flagged', 'excluded'] as const).map((key) => (
                    <div key={key} className="frame-hairline min-w-0 rounded-lg px-3 py-3 sm:px-4">
                        <dt className="text-xs text-muted-foreground">{t(`dataQuality.counts.${key}`)}</dt>
                        <dd className="numeral mt-1 font-display text-2xl text-ink">{formatNumber(r.counts[key], locale)}</dd>
                    </div>
                ))}
            </dl>

            <Panel
                title={t('dataQuality.participation.title')}
                hint={t('dataQuality.participation.hint', { min: formatPercent(r.minParticipation, locale, 0) })}
            >
                <ul className="divide-y divide-border rounded-lg border border-border" data-testid="quality-strata">
                    {r.strata.map((s) => (
                        <StratumItem key={s.stratumId} row={s} canEdit={props.canReview} assessment={props.assessment.id} />
                    ))}
                </ul>
                <ReviewBlock
                    kind="PARTICIPATION"
                    review={r.reviews.PARTICIPATION}
                    canEdit={props.canReview}
                    assessment={props.assessment.id}
                    warning={missingJustification ? t('dataQuality.review.needsJustification') : null}
                />
            </Panel>

            <Panel title={t('dataQuality.reliability.title')}>
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                        <p className="text-sm text-muted-foreground">
                            {t('dataQuality.reliability.alphaHint', { min: formatNumber(r.alphaMin, locale, 2) })}
                        </p>
                        <MetricTable
                            label={t('dataQuality.reliability.dimension')}
                            metric={t('dataQuality.reliability.alpha')}
                            minCell={r.minCell}
                            rows={r.alpha.map((a) => ({
                                key: a.code,
                                name: `${a.code} ${a.name}`,
                                value: a.alpha,
                                n: a.n,
                                below: a.belowThreshold,
                            }))}
                        />
                    </div>
                    <div className="min-w-0 space-y-2">
                        <p className="text-sm text-muted-foreground">
                            {t('dataQuality.reliability.rwgHint', { min: formatNumber(r.rwgMin, locale, 2) })}
                        </p>
                        <MetricTable
                            label={t('dataQuality.reliability.unit')}
                            metric={t('dataQuality.reliability.rwg')}
                            minCell={r.minCell}
                            rows={r.rwg.map((u) => ({
                                key: u.unitId,
                                name: u.name,
                                value: u.average,
                                n: u.n,
                                below: u.belowThreshold,
                            }))}
                        />
                    </div>
                </div>
            </Panel>

            <Panel title={t('dataQuality.flagged.title')} hint={t('dataQuality.flagged.hint')}>
                {r.flagged.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('dataQuality.flagged.empty')}</p>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-left text-sm" data-testid="quality-flagged">
                            <thead className="border-b border-border text-xs text-muted-foreground">
                                <tr>
                                    <th className="py-2 pr-3">{t('dataQuality.flagged.flags')}</th>
                                    <th className="py-2 pr-3">{t('dataQuality.flagged.date')}</th>
                                    <th className="py-2 pr-3">{t('dataQuality.flagged.duration')}</th>
                                    <th className="py-2 pr-3">{t('dataQuality.flagged.status')}</th>
                                    {props.canExclude ? <th className="py-2" /> : null}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {flagged.map((f) => (
                                    <tr key={f.id}>
                                        <td className="py-2 pr-3">
                                            {f.flags.length === 0
                                                ? null
                                                : f.flags.map((flag) => t(`dataQuality.flagged.flagNames.${flag}`)).join(', ')}
                                        </td>
                                        <td className="py-2 pr-3 whitespace-nowrap">{f.submittedOn ?? ''}</td>
                                        <td className="py-2 pr-3">{t(`dataQuality.flagged.durations.${f.durationBucket}`)}</td>
                                        <td className={cn('py-2 pr-3', f.excluded && 'text-destructive')}>
                                            {f.excluded ? t('dataQuality.flagged.excluded') : t('dataQuality.flagged.included')}
                                            {f.reason ? (
                                                <span className="block text-xs text-muted-foreground">{f.reason}</span>
                                            ) : null}
                                        </td>
                                        {props.canExclude ? (
                                            <td className="py-2 text-right">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        const url = DataQualityController.exclusion.url({
                                                            assessment: props.assessment.id,
                                                            response: f.id,
                                                        });
                                                        if (f.excluded) {
                                                            router.put(url, { excluded: false }, { preserveScroll: true });
                                                            return;
                                                        }
                                                        const reason = window.prompt(t('dataQuality.flagged.reasonPrompt'));
                                                        if (reason && reason.trim().length >= 5) {
                                                            router.put(
                                                                url,
                                                                { excluded: true, reason: reason.trim() },
                                                                { preserveScroll: true },
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {f.excluded ? <RotateCcw aria-hidden /> : <ShieldOff aria-hidden />}
                                                    {f.excluded
                                                        ? t('dataQuality.flagged.restore')
                                                        : t('dataQuality.flagged.exclude')}
                                                </Button>
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {r.flagged.length > FLAGGED_PREVIEW ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={() => setAllFlagged(!allFlagged)}
                            >
                                {allFlagged
                                    ? t('dataQuality.flagged.showFewer')
                                    : t('dataQuality.flagged.showAll', { count: r.flagged.length })}
                            </Button>
                        ) : null}
                        {allFlagged && r.flagged.length >= FLAGGED_LIMIT ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                                {t('dataQuality.flagged.limited', { count: FLAGGED_LIMIT })}
                            </p>
                        ) : null}
                    </div>
                )}
                <ReviewBlock
                    kind="DATA_QUALITY"
                    review={r.reviews.DATA_QUALITY}
                    canEdit={props.canReview}
                    assessment={props.assessment.id}
                    warning={null}
                />
            </Panel>
        </CollectionShell>
    );
}

function StratumItem({ row, canEdit, assessment }: { row: StratumRow; canEdit: boolean; assessment: string }) {
    const t = useT();
    const locale = useLocale();
    const form = useForm({ stratumId: row.stratumId, justification: row.justification ?? '' });
    return (
        <li className="space-y-3 px-4 py-3" data-code={row.code} data-below={row.belowMinimum ? 'true' : 'false'}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="min-w-0 basis-full text-sm font-medium text-ink sm:flex-1 sm:basis-auto">
                    {row.code} {row.name}
                </p>
                <p className="numeral text-sm text-charcoal">
                    {row.completed.suppressed || row.completed.value === null
                        ? t('hiddenCell')
                        : `${formatNumber(row.completed.value, locale)} / ${formatNumber(row.population, locale)}`}
                    {row.rate !== null ? ` (${formatPercent(row.rate, locale)})` : ''}
                </p>
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        row.belowMinimum ? 'bg-gold/15 text-gold-deep' : 'bg-success/10 text-success',
                    )}
                >
                    {row.belowMinimum ? t('dataQuality.participation.below') : t('dataQuality.participation.ok')}
                </span>
            </div>
            {row.belowMinimum ? (
                canEdit ? (
                    <form
                        className="space-y-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.put(DataQualityController.justify.url(assessment), { preserveScroll: true });
                        }}
                    >
                        <Field
                            id={`just-${row.stratumId}`}
                            label={t('dataQuality.participation.justification')}
                            hint={t('dataQuality.participation.justificationHint')}
                            error={form.errors.justification ?? form.errors.stratumId}
                        >
                            <TextArea
                                id={`just-${row.stratumId}`}
                                rows={2}
                                minLength={20}
                                maxLength={2000}
                                required
                                value={form.data.justification}
                                onChange={(e) => form.setData('justification', e.target.value)}
                            />
                        </Field>
                        <Button type="submit" size="sm" variant="outline" disabled={form.processing}>
                            {t('dataQuality.participation.save')}
                        </Button>
                    </form>
                ) : (
                    <p className="text-sm text-charcoal">
                        {row.justification ?? (
                            <span className="text-muted-foreground">{t('dataQuality.participation.missing')}</span>
                        )}
                    </p>
                )
            ) : null}
        </li>
    );
}

function MetricTable({
    label,
    metric,
    minCell,
    rows,
}: {
    label: string;
    metric: string;
    minCell: number;
    rows: { key: string; name: string; value: number | null; n: number | null; below: boolean }[];
}) {
    const t = useT();
    const locale = useLocale();
    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('dataQuality.reliability.empty')}</p>;
    }
    return (
        <div className="relative overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                        <th className="py-2 pr-3">{label}</th>
                        <th className="py-2 pr-3 text-right">{metric}</th>
                        <th className="py-2 text-right">{t('dataQuality.reliability.n')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                        <tr key={row.key}>
                            <td className="py-2 pr-3">{row.name}</td>
                            <td
                                className={cn('numeral py-2 pr-3 text-right', row.below && 'font-semibold text-gold-deep')}
                                title={row.below ? t('dataQuality.reliability.below') : undefined}
                            >
                                {row.value === null ? (
                                    <span className="text-xs text-muted-foreground" title={t('hiddenCellHint', { min: minCell })}>
                                        {t('hiddenCell')}
                                    </span>
                                ) : (
                                    formatNumber(row.value, locale, 2)
                                )}
                                {row.below ? <span className="sr-only"> {t('dataQuality.reliability.below')}</span> : null}
                            </td>
                            <td className="numeral py-2 text-right">{row.n === null ? '' : formatNumber(row.n, locale)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ReviewBlock({
    kind,
    review,
    canEdit,
    assessment,
    warning,
}: {
    kind: Kind;
    review: Review;
    canEdit: boolean;
    assessment: string;
    warning: string | null;
}) {
    const t = useT();
    const locale = useLocale();
    const form = useForm({ kind, note: review?.note ?? '' });
    return (
        <div className="space-y-3 border-t border-border pt-4" data-testid={`review-${kind}`}>
            <p className="flex items-start gap-2 text-sm">
                <BadgeCheck
                    aria-hidden
                    className={cn('mt-0.5 size-4 shrink-0', review ? 'text-success' : 'text-muted-foreground')}
                />
                <span>
                    <strong className="font-semibold text-ink">{t(`dataQuality.review.${kind}`)}.</strong>{' '}
                    {review
                        ? t('dataQuality.review.done', { name: review.by ?? '', date: formatDateTime(review.at, locale) })
                        : t('dataQuality.review.pending')}
                    {review?.note ? <span className="block text-charcoal">{review.note}</span> : null}
                </span>
            </p>
            {warning ? <p className="text-sm text-gold-deep">{warning}</p> : null}
            {canEdit ? (
                <form
                    className="flex flex-col gap-2 sm:flex-row sm:items-start"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.put(DataQualityController.review.url(assessment), { preserveScroll: true });
                    }}
                >
                    <Input
                        aria-label={t('dataQuality.review.note')}
                        placeholder={t('dataQuality.review.note')}
                        maxLength={2000}
                        value={form.data.note}
                        onChange={(e) => form.setData('note', e.target.value)}
                        className="sm:max-w-lg"
                    />
                    <Button type="submit" size="sm" disabled={form.processing} data-testid={`review-submit-${kind}`}>
                        {review ? t('dataQuality.review.update') : t('dataQuality.review.mark')}
                    </Button>
                    <FormError message={form.errors.kind} />
                </form>
            ) : null}
        </div>
    );
}
