import { CollectionShell, formatPercent } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Panel, formatNumber } from '@/components/nscas/setup-shell';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Group = 'MANAGEMENT' | 'SUPERVISORY' | 'FIELD';
type Cell = { value: number | null; n: number; suppressed: boolean };
type Row = {
    characteristicId: string;
    code: string;
    name: string;
    aspectCode: string;
    contextual: boolean;
    answered: number;
    survey: number | null;
    suppressed: boolean;
    dontKnowShare: number | null;
    groups: Record<Group, Cell>;
    gap: number | null;
    gapAttention: boolean;
    selfAssessment: { mean: number | null; n: number };
    selfAssessmentGap: number | null;
    evidenceTypes: number;
    evidenceBelowMinimum: boolean;
};
type Findings = {
    responses: number;
    minCell: number;
    gapAttention: number;
    characteristics: Row[];
    aspects: { aspectCode: string; groups: Record<Group, Cell>; gap: number | null; gapAttention: boolean }[];
    climate: { code: string; name: string; groups: Record<Group, Cell> }[];
    focus: { characteristicId: string; code: string; reasons: string[] }[];
};
type Props = CollectionCommon & { findings: Findings };

const GROUPS: Group[] = ['MANAGEMENT', 'SUPERVISORY', 'FIELD'];

/** Temuan awal tanpa tingkat untuk mengarahkan validasi (docs/12 temuan T4). */
export default function FindingsPage(props: Props) {
    const t = useT();
    const locale = useLocale();
    const f = props.findings;
    const names = new Map(f.characteristics.map((c) => [c.characteristicId, c.name]));
    const focusIds = new Set(f.focus.map((x) => x.characteristicId));
    const gapText = formatNumber(f.gapAttention, locale, 1);

    return (
        <CollectionShell module="findings" common={props} canEdit={false} readOnlyNotice={false} showWindow={false}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('findings.intro', { min: f.minCell })}</p>

            <dl className="grid grid-cols-2 gap-3 sm:max-w-xl">
                <div className="frame-hairline min-w-0 rounded-lg px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{t('findings.responses')}</dt>
                    <dd className="numeral mt-1 font-display text-2xl text-ink">{formatNumber(f.responses, locale)}</dd>
                </div>
                <div className="frame-hairline min-w-0 rounded-lg px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{t('findings.focusCount')}</dt>
                    <dd className="numeral mt-1 font-display text-2xl text-ink">{f.focus.length}</dd>
                </div>
            </dl>

            <Panel title={t('findings.focus.title')}>
                {f.focus.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('findings.focus.empty')}</p>
                ) : (
                    <ol className="space-y-3" data-testid="findings-focus">
                        {f.focus.map((x) => (
                            <li key={x.characteristicId} className="space-y-1.5">
                                <p className="text-sm font-medium text-ink">
                                    {x.code} {names.get(x.characteristicId)}
                                </p>
                                <ul className="flex flex-wrap gap-1.5">
                                    {x.reasons.map((reason) => (
                                        <li
                                            key={reason}
                                            className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold-deep"
                                        >
                                            {t(`findings.focus.reasons.${reason}`)}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ol>
                )}
            </Panel>

            <Panel title={t('findings.table.title')} hint={t('findings.table.hint', { value: gapText })}>
                <div className="relative overflow-x-auto">
                    <table className="w-full min-w-[56rem] text-left text-sm" data-testid="findings-table">
                        <thead className="border-b border-border text-xs text-muted-foreground">
                            <tr>
                                <th className="py-2 pr-3">{t('findings.table.characteristic')}</th>
                                <th className="py-2 pr-3 text-right">{t('findings.table.survey')}</th>
                                {GROUPS.map((g) => (
                                    <th key={g} className="py-2 pr-3 text-right">
                                        {t(`groupsShort.${g}`)}
                                    </th>
                                ))}
                                <th className="py-2 pr-3 text-right">{t('findings.table.gap')}</th>
                                <th className="py-2 pr-3 text-right">{t('findings.table.self')}</th>
                                <th className="py-2 pr-3 text-right">{t('findings.table.dontKnow')}</th>
                                <th className="py-2 text-right">{t('findings.table.evidence')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {f.characteristics.map((c) => (
                                <tr key={c.characteristicId} className={cn(focusIds.has(c.characteristicId) && 'bg-gold/5')}>
                                    <td className="py-2 pr-3">
                                        <span className="font-medium text-ink">{c.code}</span> {c.name}
                                        {c.contextual ? (
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({t('findings.table.contextual')})
                                            </span>
                                        ) : null}
                                    </td>
                                    <NumberCell value={c.survey} minCell={f.minCell} />
                                    {GROUPS.map((g) => (
                                        <NumberCell key={g} value={c.groups[g].value} minCell={f.minCell} />
                                    ))}
                                    <NumberCell value={c.gap} minCell={f.minCell} attention={c.gapAttention} signed />
                                    <td className="numeral py-2 pr-3 text-right">
                                        {c.selfAssessment.mean === null ? (
                                            <span className="text-xs text-muted-foreground">{t('findings.table.none')}</span>
                                        ) : (
                                            formatNumber(c.selfAssessment.mean, locale, 1)
                                        )}
                                    </td>
                                    <td className="numeral py-2 pr-3 text-right">
                                        {c.dontKnowShare === null ? '' : formatPercent(c.dontKnowShare, locale, 0)}
                                    </td>
                                    <td className={cn('numeral py-2 text-right', c.evidenceBelowMinimum && 'text-gold-deep')}>
                                        {c.evidenceTypes}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            <div className="grid gap-8 lg:grid-cols-2">
                <Panel title={t('findings.aspects.title')} className="min-w-0">
                    <GroupTable
                        label={t('findings.aspects.aspect')}
                        minCell={f.minCell}
                        rows={f.aspects.map((a) => ({
                            key: a.aspectCode,
                            name: a.aspectCode,
                            groups: a.groups,
                            gap: a.gap,
                            attention: a.gapAttention,
                        }))}
                        withGap
                    />
                </Panel>
                <Panel title={t('findings.climate.title')} className="min-w-0">
                    <GroupTable
                        label={t('findings.climate.dimension')}
                        minCell={f.minCell}
                        rows={f.climate.map((d) => ({
                            key: d.code,
                            name: `${d.code} ${d.name}`,
                            groups: d.groups,
                            gap: null,
                            attention: false,
                        }))}
                    />
                </Panel>
            </div>
        </CollectionShell>
    );
}

function NumberCell({
    value,
    minCell,
    attention = false,
    signed = false,
}: {
    value: number | null;
    minCell: number;
    attention?: boolean;
    signed?: boolean;
}) {
    const t = useT();
    const locale = useLocale();
    return (
        <td className={cn('numeral py-2 pr-3 text-right', attention && 'font-semibold text-gold-deep')}>
            {value === null ? (
                <span className="text-xs text-muted-foreground" title={t('hiddenCellHint', { min: minCell })}>
                    {t('hiddenCell')}
                </span>
            ) : (
                `${signed && value > 0 ? '+' : ''}${formatNumber(value, locale, 2)}`
            )}
        </td>
    );
}

function GroupTable({
    label,
    minCell,
    rows,
    withGap = false,
}: {
    label: string;
    minCell: number;
    rows: { key: string; name: string; groups: Record<Group, Cell>; gap: number | null; attention: boolean }[];
    withGap?: boolean;
}) {
    const t = useT();
    return (
        <div className="relative overflow-x-auto">
            <table className="w-full min-w-[26rem] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                        <th className="py-2 pr-3">{label}</th>
                        {GROUPS.map((g) => (
                            <th key={g} className="py-2 pr-3 text-right">
                                {t(`groupsShort.${g}`)}
                            </th>
                        ))}
                        {withGap ? <th className="py-2 pr-3 text-right">{t('findings.table.gap')}</th> : null}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                        <tr key={row.key}>
                            <td className="py-2 pr-3">{row.name}</td>
                            {GROUPS.map((g) => (
                                <NumberCell key={g} value={row.groups[g].value} minCell={minCell} />
                            ))}
                            {withGap ? <NumberCell value={row.gap} minCell={minCell} attention={row.attention} signed /> : null}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
