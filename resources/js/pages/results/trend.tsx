import { CollectionShell } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Panel, formatNumber } from '@/components/nscas/setup-shell';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Period = {
    id: string;
    name: string;
    periodStart: string;
    index: number;
    level: number;
    aspects: Record<string, number | null>;
    delta: number | null;
    levelDelta: number | null;
    aspectDeltas: Record<string, number | null>;
    current: boolean;
};
type Props = CollectionCommon & { trend: { periods: Period[]; aspects: { code: string; name: string }[] } };

function signed(v: number, locale: 'id' | 'en', digits = 2): string {
    return `${v > 0 ? '+' : ''}${formatNumber(v, locale, digits)}`;
}

/** Perbandingan antarperiode (docs/01 M9): hasil final dengan versi instrumen yang sama. */
export default function Trend(props: Props) {
    const t = useT();
    const locale = useLocale();
    const { periods, aspects } = props.trend;
    const year = (d: string) =>
        new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
            new Date(`${d}T00:00:00Z`),
        );

    return (
        <CollectionShell module="trend" common={props} canEdit={false} readOnlyNotice={false} showWindow={false}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('trend.intro')}</p>
            {periods.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="trend-empty">
                    {t('trend.empty')}
                </p>
            ) : (
                <>
                    {periods.length === 1 ? <p className="text-sm text-charcoal">{t('trend.single')}</p> : null}
                    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="trend-periods">
                        {periods.map((p) => (
                            <li
                                key={p.id}
                                className={cn('min-w-0 rounded-lg px-4 py-3', p.current ? 'frame-gold' : 'frame-hairline')}
                            >
                                <p className="truncate text-sm font-medium text-ink" title={p.name}>
                                    {p.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {year(p.periodStart)}
                                    {p.current ? `, ${t('trend.current')}` : ''}
                                </p>
                                <p className="mt-2 flex items-baseline gap-3">
                                    <span className="numeral font-display text-3xl text-ink">
                                        {formatNumber(p.index, locale, 2)}
                                    </span>
                                    <span className="text-sm text-charcoal">
                                        {t('trend.level')} {p.level}
                                    </span>
                                </p>
                                {p.delta !== null ? (
                                    <p className={cn('numeral text-sm', p.delta >= 0 ? 'text-success' : 'text-destructive')}>
                                        {t('trend.change')}: {signed(p.delta, locale)}
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                    <Panel title={t('trend.aspects')}>
                        <div className="relative overflow-x-auto">
                            <table className="w-full min-w-[32rem] text-left text-sm" data-testid="trend-aspects">
                                <thead className="border-b border-border text-xs text-muted-foreground">
                                    <tr>
                                        <th className="py-2 pr-3" />
                                        {periods.map((p) => (
                                            <th key={p.id} className="py-2 pr-3 text-right">
                                                {year(p.periodStart)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {aspects.map((a) => (
                                        <tr key={a.code}>
                                            <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                                                <span className="font-medium">{a.code}</span> {a.name}
                                            </th>
                                            {periods.map((p) => (
                                                <td key={p.id} className="numeral py-2 pr-3 text-right">
                                                    {p.aspects[a.code] === null || p.aspects[a.code] === undefined
                                                        ? ''
                                                        : formatNumber(p.aspects[a.code] ?? 0, locale, 2)}
                                                    {p.aspectDeltas[a.code] !== null && p.aspectDeltas[a.code] !== undefined ? (
                                                        <span
                                                            className={cn(
                                                                'block text-xs',
                                                                (p.aspectDeltas[a.code] ?? 0) >= 0
                                                                    ? 'text-success'
                                                                    : 'text-destructive',
                                                            )}
                                                        >
                                                            {signed(p.aspectDeltas[a.code] ?? 0, locale)}
                                                        </span>
                                                    ) : null}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </>
            )}
        </CollectionShell>
    );
}
