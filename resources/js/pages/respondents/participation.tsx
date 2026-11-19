import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CollectionShell, formatPercent } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Panel, formatNumber } from '@/components/nscas/setup-shell';
import { formatDate, useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Masked = { value: number | null; suppressed: boolean };
type StratumRow = {
    stratumId: string;
    code: string;
    name: string;
    population: number;
    registered: number;
    issued: number;
    completed: Masked;
    rate: number | null;
    belowMinimum: boolean;
};
type UnitRow = {
    unitId: string;
    name: string;
    depth: number;
    registered: number;
    issued: number;
    completed: Masked;
    rate: number | null;
};
type Props = CollectionCommon & {
    scoped: boolean;
    minCell: number;
    minParticipation: number;
    summary: {
        strata: StratumRow[];
        units: UnitRow[];
        pendingStratumSelection: number;
        totals: { population: number; registered: number; issued: number; completed: Masked; rate: number | null };
        strataBelowMinimum: number;
    };
    trend: { date: string; completed: Masked; rate: number | null }[];
    surveyTarget: number | null;
};

/** Partisipasi per strata dan unit (tahap 2, docs/01 M2). Jumlah selesai di bawah ambang sel disembunyikan. */
export default function RespondentsParticipation(props: Props) {
    const t = useT();
    const locale = useLocale();
    const min = formatPercent(props.minParticipation, locale, 0);
    const count = (m: Masked) =>
        m.suppressed ? t('participation.suppressed', { min: props.minCell }) : formatNumber(m.value ?? 0, locale);
    const rate = (r: number | null) => (r === null ? t('participation.notAvailable') : formatPercent(r, locale));
    const totals = props.summary.totals;

    return (
        <CollectionShell module="participation" common={props} canEdit={false} readOnlyNotice={false}>
            <div className="max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>{t('participation.intro', { min: props.minCell })}</p>
                {props.scoped ? <p className="text-charcoal">{t('participation.scoped')}</p> : null}
            </div>

            <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6" data-testid="participation-totals">
                <Stat label={t('participation.totals.population')} value={formatNumber(totals.population, locale)} />
                {props.surveyTarget !== null ? (
                    <Stat label={t('participation.totals.target')} value={formatNumber(props.surveyTarget, locale)} />
                ) : null}
                <Stat label={t('participation.totals.registered')} value={formatNumber(totals.registered, locale)} />
                <Stat label={t('participation.totals.issued')} value={formatNumber(totals.issued, locale)} />
                <Stat label={t('participation.totals.completed')} value={count(totals.completed)} />
                <Stat label={t('participation.totals.rate')} value={rate(totals.rate)} />
            </dl>

            <p
                className={cn(
                    'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
                    props.summary.strataBelowMinimum > 0
                        ? 'border-gold/60 bg-gold/10 text-ink'
                        : 'border-success/30 bg-success/10 text-success',
                )}
            >
                {props.summary.strataBelowMinimum > 0 ? (
                    <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                ) : (
                    <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
                )}
                {props.summary.strataBelowMinimum > 0
                    ? t('participation.belowCount', { count: props.summary.strataBelowMinimum, min })
                    : t('participation.allAbove', { min })}
            </p>
            {props.summary.pendingStratumSelection > 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('participation.pendingStratum', { count: formatNumber(props.summary.pendingStratumSelection, locale) })}
                </p>
            ) : null}

            <Panel title={t('participation.strata.title')}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[44rem] text-left text-sm" data-testid="participation-strata">
                        <thead className="border-b border-border text-xs text-muted-foreground">
                            <tr>
                                <th className="py-2 pr-3">{t('participation.strata.code')}</th>
                                <th className="py-2 pr-3">{t('participation.strata.name')}</th>
                                <th className="py-2 pr-3 text-right">{t('participation.strata.population')}</th>
                                <th className="py-2 pr-3 text-right">{t('participation.strata.registered')}</th>
                                <th className="py-2 pr-3 text-right">{t('participation.strata.completed')}</th>
                                <th className="py-2 pr-3 text-right">{t('participation.strata.rate')}</th>
                                <th className="py-2">{t('participation.strata.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {props.summary.strata.map((s) => (
                                <tr key={s.stratumId}>
                                    <td className="py-2 pr-3 font-medium text-ink">{s.code}</td>
                                    <td className="py-2 pr-3">{s.name}</td>
                                    <td className="numeral py-2 pr-3 text-right">{formatNumber(s.population, locale)}</td>
                                    <td className="numeral py-2 pr-3 text-right">{formatNumber(s.registered, locale)}</td>
                                    <td className="numeral py-2 pr-3 text-right">{count(s.completed)}</td>
                                    <td className="numeral py-2 pr-3 text-right">{rate(s.rate)}</td>
                                    <td className={cn('py-2', s.belowMinimum ? 'text-gold-deep' : 'text-success')}>
                                        {s.belowMinimum ? t('participation.strata.below', { min }) : t('participation.strata.ok')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            <Panel title={t('participation.units.title')} hint={t('participation.units.note')}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-left text-sm" data-testid="participation-units">
                        <thead className="border-b border-border text-xs text-muted-foreground">
                            <tr>
                                <th className="py-2 pr-3">{t('participation.units.name')}</th>
                                <th className="py-2 pr-3 text-right">{t('participation.units.registered')}</th>
                                <th className="py-2 pr-3 text-right">{t('participation.units.issued')}</th>
                                <th className="py-2 pr-3 text-right">{t('participation.units.completed')}</th>
                                <th className="py-2 text-right">{t('participation.units.rate')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {props.summary.units.map((u) => (
                                <tr key={u.unitId}>
                                    <td className="py-2 pr-3" style={{ paddingLeft: `${u.depth * 1.25}rem` }}>
                                        {u.name}
                                    </td>
                                    <td className="numeral py-2 pr-3 text-right">{formatNumber(u.registered, locale)}</td>
                                    <td className="numeral py-2 pr-3 text-right">{formatNumber(u.issued, locale)}</td>
                                    <td className="numeral py-2 pr-3 text-right">{count(u.completed)}</td>
                                    <td className="numeral py-2 text-right">{rate(u.rate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {!props.scoped ? (
                <Panel title={t('participation.trend.title')} hint={t('participation.trend.intro')}>
                    {props.trend.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('participation.trend.empty')}</p>
                    ) : (
                        <ol className="space-y-2" data-testid="participation-trend">
                            {props.trend.map((p) => (
                                <li key={p.date} className="grid grid-cols-[9rem_minmax(0,1fr)_7rem] items-center gap-3 text-sm">
                                    <span className="text-charcoal">{formatDate(p.date, locale)}</span>
                                    <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                                        <span
                                            className="block h-full rounded-full bg-maroon"
                                            style={{ width: `${Math.min(1, p.rate ?? 0) * 100}%` }}
                                        />
                                    </span>
                                    <span className="numeral text-right">
                                        {count(p.completed)} · {rate(p.rate)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </Panel>
            ) : null}
        </CollectionShell>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="frame-hairline rounded-lg px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="numeral mt-1 font-display text-2xl text-ink">{value}</dd>
        </div>
    );
}
