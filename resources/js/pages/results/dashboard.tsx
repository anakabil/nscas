import { Download, Info } from 'lucide-react';
import { useState } from 'react';
import ResultsController from '@/actions/App/Http/Controllers/Results/ResultsController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Panel, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Group = 'MANAGEMENT' | 'SUPERVISORY' | 'FIELD';
type Cell = { value: number | null; n: number; suppressed: boolean };
type HeatMap = { columns: { id: string; label: string; name?: string }[]; rows: { aspectCode: string; cells: Cell[] }[] };
type Scenario = {
    up: string;
    down: string;
    weights: Record<string, number>;
    index: number;
    level: number;
    delta: number;
    levelChanged: boolean;
};
type Results = {
    provisional: boolean;
    runAt: string;
    finalizedAt: string | null;
    targetLevel: number;
    minCell: number;
    organization: { index: number; indicativeLevel: number; consolidated: boolean; gapToTarget: number; priorityAspect: string };
    sclLevel: number | null;
    aspects: {
        code: string;
        name: string;
        index: number | null;
        min: number | null;
        weight: number;
        gapToTarget: number | null;
    }[];
    characteristics: {
        code: string;
        name: string;
        nameEn: string | null;
        aspectCode: string;
        contextual: boolean;
        value: number | null;
        panel: number | null;
        flags: string[];
    }[];
    divergence: string[];
    perceptionGap: { aspectCode: string; groups: Record<Group, Cell>; gap: number | null; gapAttention: boolean }[];
    gapAttention: number;
    heatmaps: { strata: HeatMap; units: HeatMap };
    quality: {
        counts: { analysed: number; excluded: number; flagged: number };
        strata: { code: string; belowMinimum: boolean }[];
        alpha: { code: string; alpha: number | null }[];
        rwg: { unitId: string; belowThreshold: boolean }[];
    };
    sensitivity: {
        base: { weights: Record<string, number>; index: number; level: number };
        scenarios: Scenario[];
        stable: boolean;
    };
};
type Props = CollectionCommon & { results: Results | null };

/** Posisi pada skala 1 sampai 5 sebagai persen lebar. */
const scale = (v: number) => `${Math.max(0, Math.min(100, ((v - 1) / 4) * 100))}%`;

/** Warna sel peta: rendah ke tinggi, selalu disertai angkanya. */
function heatClass(v: number | null): string {
    if (v === null) return 'bg-muted text-muted-foreground';
    if (v < 2) return 'bg-destructive/20 text-ink';
    if (v < 2.5) return 'bg-destructive/10 text-ink';
    if (v < 3) return 'bg-gold/25 text-ink';
    if (v < 3.5) return 'bg-gold/10 text-ink';
    if (v < 4) return 'bg-success/10 text-ink';
    return 'bg-success/25 text-ink';
}

/** Dasbor hasil (docs/01 M9). */
export default function Dashboard(props: Props) {
    const t = useT();
    const locale = useLocale();
    const r = props.results;
    const [map, setMap] = useState<'strata' | 'units'>('strata');

    return (
        <CollectionShell module="dashboard" common={props} canEdit={false} readOnlyNotice={false} showWindow={false}>
            <p className="flex items-start gap-2 text-sm text-charcoal" data-testid="not-certificate">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                {t('results.notCertificate')}
            </p>
            {r === null ? (
                <p className="text-sm text-muted-foreground" data-testid="results-empty">
                    {t('results.empty')}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p
                            className={cn('text-sm', r.provisional ? 'font-medium text-gold-deep' : 'text-charcoal')}
                            data-testid="results-status"
                        >
                            {r.provisional
                                ? t('results.provisional')
                                : t('results.final', { date: r.finalizedAt ? formatWib(r.finalizedAt, locale) : '' })}
                        </p>
                        <Button asChild variant="outline" size="sm">
                            <a href={ResultsController.export.url(props.assessment.id)} data-testid="results-export">
                                <Download aria-hidden />
                                {t('results.export')}
                            </a>
                        </Button>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="results-cards">
                        <div className="frame-gold min-w-0 rounded-lg px-4 py-3">
                            <dt className="text-xs text-muted-foreground">{t('results.cards.index')}</dt>
                            <dd className="numeral font-display text-3xl text-ink">
                                {formatNumber(r.organization.index, locale, 2)}
                            </dd>
                            <dd className="text-xs text-muted-foreground">
                                {t('results.cards.target', { value: r.targetLevel })}
                            </dd>
                        </div>
                        <div className="frame-hairline min-w-0 rounded-lg px-4 py-3">
                            <dt className="text-xs text-muted-foreground">{t('results.cards.level')}</dt>
                            <dd className="numeral font-display text-3xl text-ink">{r.organization.indicativeLevel}</dd>
                            <dd className={cn('text-xs', r.organization.consolidated ? 'text-success' : 'text-gold-deep')}>
                                {r.organization.consolidated
                                    ? t('results.cards.consolidated')
                                    : t('results.cards.notConsolidated')}
                            </dd>
                        </div>
                        <div className="frame-hairline min-w-0 rounded-lg px-4 py-3">
                            <dt className="text-xs text-muted-foreground">{t('results.cards.gap')}</dt>
                            <dd className="numeral font-display text-3xl text-ink">
                                {formatNumber(r.organization.gapToTarget, locale, 2)}
                            </dd>
                            <dd className="text-xs text-muted-foreground">
                                {t('results.cards.priority')}: {r.organization.priorityAspect}
                            </dd>
                        </div>
                        <div className="frame-hairline min-w-0 rounded-lg px-4 py-3">
                            <dt className="text-xs text-muted-foreground">{t('results.cards.scl')}</dt>
                            <dd className="numeral font-display text-3xl text-ink">{r.sclLevel ?? ''}</dd>
                        </div>
                    </dl>

                    <Panel title={t('results.aspects.title')} hint={t('results.aspects.hint')}>
                        <ul className="space-y-3" data-testid="results-aspects">
                            {r.aspects.map((a) => (
                                <li key={a.code} className="space-y-1">
                                    <p className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="min-w-0 text-ink">
                                            <span className="font-medium">{a.code}</span> {a.name}
                                        </span>
                                        <span className="numeral shrink-0 font-semibold text-ink">
                                            {a.index === null ? '' : formatNumber(a.index, locale, 2)}
                                        </span>
                                    </p>
                                    <Bar value={a.index} target={r.targetLevel} />
                                </li>
                            ))}
                        </ul>
                    </Panel>

                    <Panel title={t('results.characteristics.title')}>
                        <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2" data-testid="results-characteristics">
                            {r.characteristics.map((c) => (
                                <li key={c.code} className="min-w-0 space-y-1">
                                    <p className="flex items-baseline justify-between gap-3 text-sm">
                                        <span
                                            className="min-w-0 truncate text-ink"
                                            title={locale === 'en' && c.nameEn ? c.nameEn : c.name}
                                        >
                                            <span className="font-medium">{c.code}</span>{' '}
                                            {locale === 'en' && c.nameEn ? c.nameEn : c.name}
                                        </span>
                                        <span className="numeral shrink-0 font-semibold text-ink">
                                            {c.value === null ? '' : formatNumber(c.value, locale, 2)}
                                        </span>
                                    </p>
                                    <Bar value={c.value} target={r.targetLevel} muted={c.contextual} />
                                    {c.panel !== null || c.contextual ? (
                                        <p className="text-xs text-muted-foreground">
                                            {c.panel !== null
                                                ? t('results.characteristics.panel')
                                                : t('results.characteristics.contextual')}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </Panel>

                    <div className="grid gap-8 lg:grid-cols-2">
                        <Panel title={t('results.divergence.title')} hint={t('results.divergence.hint')} className="min-w-0">
                            {r.divergence.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t('results.divergence.empty')}</p>
                            ) : (
                                <ul className="flex flex-wrap gap-2" data-testid="results-divergence">
                                    {r.divergence.map((code) => (
                                        <li
                                            key={code}
                                            className="rounded-full bg-gold/15 px-3 py-1 text-sm font-medium text-gold-deep"
                                        >
                                            {code}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                        <Panel
                            title={t('results.gap.title')}
                            hint={t('results.gap.hint', { value: formatNumber(r.gapAttention, locale, 1) })}
                            className="min-w-0"
                        >
                            <ul className="space-y-2 text-sm" data-testid="results-gap">
                                {r.perceptionGap.map((g) => (
                                    <li key={g.aspectCode} className="flex items-baseline justify-between gap-3">
                                        <span className="text-ink">{g.aspectCode}</span>
                                        <span
                                            className={cn(
                                                'numeral',
                                                g.gapAttention ? 'font-semibold text-gold-deep' : 'text-ink',
                                            )}
                                        >
                                            {g.gap === null ? (
                                                <span
                                                    className="text-xs text-muted-foreground"
                                                    title={t('hiddenCellHint', { min: r.minCell })}
                                                >
                                                    {t('hiddenCell')}
                                                </span>
                                            ) : (
                                                `${g.gap > 0 ? '+' : ''}${formatNumber(g.gap, locale, 2)}`
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    </div>

                    <Panel title={t('results.heatmap.title')} hint={t('results.heatmap.hint', { min: r.minCell })}>
                        <div
                            role="tablist"
                            aria-label={t('results.heatmap.title')}
                            className="inline-flex rounded-md border border-border p-1"
                        >
                            {(['strata', 'units'] as const).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={map === key}
                                    onClick={() => setMap(key)}
                                    className={cn(
                                        'rounded px-3.5 py-1.5 text-sm font-medium transition-colors',
                                        map === key ? 'bg-maroon text-parchment' : 'text-foreground hover:bg-muted',
                                    )}
                                >
                                    {t(`results.heatmap.${key}`)}
                                </button>
                            ))}
                        </div>
                        <HeatTable map={r.heatmaps[map]} minCell={r.minCell} />
                    </Panel>

                    <div className="grid gap-8 lg:grid-cols-2">
                        <Panel title={t('results.quality.title')} className="min-w-0">
                            <dl className="grid grid-cols-2 gap-3 text-sm" data-testid="results-quality">
                                <Stat
                                    label={t('results.quality.analysed')}
                                    value={formatNumber(r.quality.counts.analysed, locale)}
                                />
                                <Stat
                                    label={t('results.quality.excluded')}
                                    value={formatNumber(r.quality.counts.excluded, locale)}
                                />
                                <Stat
                                    label={t('results.quality.belowParticipation')}
                                    value={String(r.quality.strata.filter((s) => s.belowMinimum).length)}
                                />
                                <Stat
                                    label={t('results.quality.lowestAlpha')}
                                    value={(() => {
                                        const values = r.quality.alpha.map((a) => a.alpha).filter((a): a is number => a !== null);
                                        return values.length ? formatNumber(Math.min(...values), locale, 2) : '';
                                    })()}
                                />
                                <Stat
                                    label={t('results.quality.lowRwg')}
                                    value={String(r.quality.rwg.filter((u) => u.belowThreshold).length)}
                                />
                            </dl>
                        </Panel>
                        <Panel title={t('results.sensitivity.title')} hint={t('results.sensitivity.hint')} className="min-w-0">
                            <p
                                className={cn('text-sm font-medium', r.sensitivity.stable ? 'text-success' : 'text-gold-deep')}
                                data-testid="sensitivity-verdict"
                            >
                                {r.sensitivity.stable ? t('results.sensitivity.stable') : t('results.sensitivity.unstable')}
                            </p>
                            <div className="relative overflow-x-auto">
                                <table className="w-full min-w-[22rem] text-left text-sm">
                                    <thead className="border-b border-border text-xs text-muted-foreground">
                                        <tr>
                                            <th className="py-2 pr-3">{t('results.sensitivity.weights')}</th>
                                            <th className="py-2 pr-3 text-right">{t('results.sensitivity.index')}</th>
                                            <th className="py-2 text-right">{t('results.sensitivity.level')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        <tr className="font-medium">
                                            <td className="py-2 pr-3">
                                                {t('results.sensitivity.base')}
                                                <span className="numeral block text-xs font-normal text-muted-foreground">
                                                    {weights(r.sensitivity.base.weights, locale)}
                                                </span>
                                            </td>
                                            <td className="numeral py-2 pr-3 text-right">
                                                {formatNumber(r.sensitivity.base.index, locale, 3)}
                                            </td>
                                            <td className="numeral py-2 text-right">{r.sensitivity.base.level}</td>
                                        </tr>
                                        {r.sensitivity.scenarios.map((s) => (
                                            <tr key={`${s.up}-${s.down}`} className={cn(s.levelChanged && 'bg-gold/10')}>
                                                <td className="py-2 pr-3">
                                                    {t('results.sensitivity.scenario', {
                                                        up: t(`layers.${s.up}`),
                                                        down: t(`layers.${s.down}`),
                                                    })}
                                                    <span className="numeral block text-xs text-muted-foreground">
                                                        {weights(s.weights, locale)}
                                                    </span>
                                                </td>
                                                <td className="numeral py-2 pr-3 text-right">
                                                    {formatNumber(s.index, locale, 3)}
                                                </td>
                                                <td
                                                    className={cn(
                                                        'numeral py-2 text-right',
                                                        s.levelChanged && 'font-semibold text-gold-deep',
                                                    )}
                                                >
                                                    {s.level}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    </div>
                </>
            )}
        </CollectionShell>
    );
}

function weights(w: Record<string, number>, locale: 'id' | 'en'): string {
    return [w.perception, w.evidence, w.validation].map((v) => formatNumber(v, locale, 2)).join('; ');
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="numeral text-lg text-ink">{value}</dd>
        </div>
    );
}

/** Batang skala 1 sampai 5 dengan garis sasaran. */
function Bar({ value, target, muted = false }: { value: number | null; target: number; muted?: boolean }) {
    return (
        <div className="relative h-2.5 rounded-full bg-muted" aria-hidden>
            {value !== null ? (
                <div
                    className={cn('absolute inset-y-0 left-0 rounded-full', muted ? 'bg-taupe' : 'bg-maroon')}
                    style={{ width: scale(value) }}
                />
            ) : null}
            <div className="absolute -inset-y-1 w-0.5 bg-gold" style={{ left: scale(target) }} />
        </div>
    );
}

function HeatTable({ map, minCell }: { map: HeatMap; minCell: number }) {
    const t = useT();
    const locale = useLocale();
    if (map.columns.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('results.heatmap.empty')}</p>;
    }
    return (
        <div className="relative overflow-x-auto">
            <table className="w-full min-w-[28rem] border-separate border-spacing-1 text-sm" data-testid="heatmap">
                <thead className="text-xs text-muted-foreground">
                    <tr>
                        <th className="px-2 py-1 text-left font-medium" />
                        {map.columns.map((c) => (
                            <th key={c.id} className="max-w-32 px-2 py-1 text-center font-medium" title={c.name ?? c.label}>
                                <span className="line-clamp-2">{c.label}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {map.rows.map((row) => (
                        <tr key={row.aspectCode}>
                            <th scope="row" className="px-2 py-1 text-left font-medium text-ink">
                                {row.aspectCode}
                            </th>
                            {row.cells.map((cell, i) => (
                                <td
                                    key={i}
                                    className={cn('numeral rounded px-2 py-2 text-center', heatClass(cell.value))}
                                    title={cell.suppressed ? t('hiddenCellHint', { min: minCell }) : undefined}
                                >
                                    {cell.value === null ? (
                                        <span className="text-xs">{t('hiddenCell')}</span>
                                    ) : (
                                        formatNumber(cell.value, locale, 2)
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
