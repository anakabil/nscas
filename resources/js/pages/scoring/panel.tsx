import { router, useForm, usePage } from '@inertiajs/react';
import { Info, Lock } from 'lucide-react';
import { useState } from 'react';
import PanelController from '@/actions/App/Http/Controllers/Scoring/PanelController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, Panel, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Decision = { kind: 'ADJUSTED' | 'CONFIRMED'; value: number | null; rationale: string; by: string | null; at: string };
type Row = {
    code: string;
    name: string;
    nameEn: string | null;
    isContextual: boolean;
    perception: number | null;
    evidence: number | null;
    validation: number | null;
    final: number | null;
    flags: string[];
    needsDecision: boolean;
    decision: Decision | null;
};
type Org = { index: number; indicativeLevel: number; consolidated: boolean; gapToTarget: number };
type PanelData = {
    id: string;
    createdAt: string;
    by: string | null;
    final: boolean;
    finalizedAt: string | null;
    finalizedBy: string | null;
    engine: Org;
    adjusted: Org;
    sclTrack: { indicativeLevel: number } | null;
    aspects: { code: string; name: string; index: number | null; weight: number }[];
    needed: string[];
    characteristics: Row[];
};
type Props = CollectionCommon & { canDecide: boolean; isLead: boolean; rationaleMin: number; panel: PanelData | null };

/** Rapat panel: keputusan tertulis untuk karakteristik bertanda, lalu penetapan dan penguncian hasil (docs/01 M8). */
export default function PanelPage(props: Props) {
    const t = useT();
    const locale = useLocale();
    const errors = usePage<{ errors: Record<string, string | undefined> }>().props.errors;
    const p = props.panel;
    const [onlyFlagged, setOnlyFlagged] = useState(true);
    const [editing, setEditing] = useState<Row | null>(null);
    const notice = p?.final ? null : props.canDecide ? null : t('panel.closed');

    return (
        <CollectionShell module="panel" common={props} canEdit={props.canDecide} showWindow={false} notice={notice}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('panel.intro')}</p>
            <p className="flex items-start gap-2 text-sm text-charcoal" data-testid="not-certificate">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                {t('panel.notCertificate')}
            </p>
            <FormError message={errors.form} />
            {p === null ? (
                <p className="text-sm text-muted-foreground">{t('panel.empty')}</p>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2" data-testid="panel-summary">
                        <ResultCard title={t('panel.summary.engine')} org={p.engine} />
                        <ResultCard
                            title={p.final ? t('panel.summary.final') : t('panel.summary.adjusted')}
                            org={p.adjusted}
                            scl={p.sclTrack?.indicativeLevel ?? null}
                            highlight
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('panel.summary.run', {
                            date: formatWib(p.createdAt, locale),
                            by: p.by ? t('scoring.runs.by', { name: p.by }) : '',
                        })}
                    </p>
                    {p.final ? (
                        <p
                            role="status"
                            className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
                        >
                            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                            {t('panel.finalized', {
                                name: p.finalizedBy ?? '',
                                date: p.finalizedAt ? formatWib(p.finalizedAt, locale) : '',
                            })}
                        </p>
                    ) : null}

                    <Panel title={t('panel.table.decision')}>
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm text-charcoal" data-testid="panel-progress">
                                {t('panel.progress', {
                                    count: p.needed.filter((code) => p.characteristics.find((c) => c.code === code)?.decision)
                                        .length,
                                    total: p.needed.length,
                                })}
                            </p>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setOnlyFlagged(!onlyFlagged)}>
                                {onlyFlagged ? t('panel.all') : t('panel.onlyFlagged')}
                            </Button>
                        </div>
                        <div className="relative overflow-x-auto">
                            <table className="w-full min-w-[46rem] text-left text-sm" data-testid="panel-table">
                                <thead className="border-b border-border text-xs text-muted-foreground">
                                    <tr>
                                        <th className="py-2 pr-3">{t('panel.table.characteristic')}</th>
                                        <th className="py-2 pr-3 text-right">{t('layers.perception')}</th>
                                        <th className="py-2 pr-3 text-right">{t('layers.evidence')}</th>
                                        <th className="py-2 pr-3 text-right">{t('layers.validation')}</th>
                                        <th className="py-2 pr-3 text-right">{t('panel.table.final')}</th>
                                        <th className="py-2">{t('panel.table.decision')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {p.characteristics
                                        .filter((c) => !onlyFlagged || c.needsDecision || c.decision)
                                        .map((c) => (
                                            <tr key={c.code} data-code={c.code}>
                                                <td className="py-2 pr-3 align-top">
                                                    <span className="font-medium text-ink">{c.code}</span>{' '}
                                                    {locale === 'en' && c.nameEn ? c.nameEn : c.name}
                                                    {c.flags.length > 0 ? (
                                                        <span className="mt-1 flex flex-wrap gap-1">
                                                            {c.flags.map((f) => (
                                                                <span
                                                                    key={f}
                                                                    className={cn(
                                                                        'rounded-full px-2 py-0.5 text-[0.6875rem] font-medium',
                                                                        f === 'SELISIH_PERSEPSI_BUKTI' ||
                                                                            f === 'PERLU_REKONSILIASI'
                                                                            ? 'bg-gold/15 text-gold-deep'
                                                                            : 'bg-muted text-muted-foreground',
                                                                    )}
                                                                >
                                                                    {t(`panel.flags.${f}`)}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    ) : null}
                                                </td>
                                                {[c.perception, c.evidence, c.validation, c.final].map((v, i) => (
                                                    <td
                                                        key={i}
                                                        className={cn(
                                                            'numeral py-2 pr-3 text-right align-top',
                                                            i === 3 && 'font-semibold text-ink',
                                                        )}
                                                    >
                                                        {v === null ? '' : formatNumber(v, locale, 2)}
                                                    </td>
                                                ))}
                                                <td className="py-2 align-top">
                                                    {c.decision ? (
                                                        <span className="block text-sm text-ink">
                                                            {c.decision.kind === 'ADJUSTED'
                                                                ? t('panel.decision.ADJUSTED', {
                                                                      value: formatNumber(c.decision.value ?? 0, locale, 2),
                                                                  })
                                                                : t('panel.decision.CONFIRMED')}
                                                            <span className="block text-xs text-muted-foreground">
                                                                {c.decision.rationale}
                                                            </span>
                                                        </span>
                                                    ) : c.needsDecision ? (
                                                        <span className="text-xs font-medium text-gold-deep">
                                                            {t('panel.decision.needed')}
                                                        </span>
                                                    ) : null}
                                                    {props.canDecide && !p.final && (c.needsDecision || c.decision) ? (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="mt-1"
                                                            onClick={() => setEditing(c)}
                                                            data-testid="decide"
                                                        >
                                                            {c.decision ? t('panel.decision.edit') : t('panel.decision.decide')}
                                                        </Button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    <Panel title={t('panel.aspects.title')}>
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="panel-aspects">
                            {p.aspects.map((a) => (
                                <li
                                    key={a.code}
                                    className="frame-hairline flex items-baseline justify-between gap-3 rounded-md px-3 py-2 text-sm"
                                >
                                    <span className="min-w-0 text-ink">
                                        <span className="font-medium">{a.code}</span> {a.name}
                                    </span>
                                    <span className="numeral font-semibold text-ink">
                                        {a.index === null ? '' : formatNumber(a.index, locale, 2)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Panel>

                    {props.canDecide && !p.final ? (
                        <div>
                            <Button
                                data-testid="finalize"
                                onClick={() => {
                                    if (window.confirm(t('panel.confirmFinalize'))) {
                                        router.post(
                                            PanelController.finalize.url(props.assessment.id),
                                            {},
                                            { preserveScroll: true },
                                        );
                                    }
                                }}
                            >
                                <Lock aria-hidden />
                                {t('panel.finalize')}
                            </Button>
                        </div>
                    ) : null}
                </>
            )}
            {editing ? (
                <DecisionDialog
                    row={editing}
                    assessment={props.assessment.id}
                    rationaleMin={props.rationaleMin}
                    onClose={() => setEditing(null)}
                />
            ) : null}
        </CollectionShell>
    );
}

function ResultCard({
    title,
    org,
    scl = null,
    highlight = false,
}: {
    title: string;
    org: Org;
    scl?: number | null;
    highlight?: boolean;
}) {
    const t = useT();
    const locale = useLocale();
    return (
        <section className={cn('min-w-0 space-y-3 rounded-lg p-5', highlight ? 'frame-gold' : 'frame-hairline')}>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <dt className="text-xs text-muted-foreground">{t('panel.summary.index')}</dt>
                    <dd className="numeral font-display text-2xl text-ink">{formatNumber(org.index, locale, 2)}</dd>
                </div>
                <div>
                    <dt className="text-xs text-muted-foreground">{t('panel.summary.level')}</dt>
                    <dd className="numeral font-display text-2xl text-ink">{org.indicativeLevel}</dd>
                    <dd className="text-xs text-muted-foreground">
                        {org.consolidated ? t('panel.summary.consolidated') : t('panel.summary.notConsolidated')}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-muted-foreground">{t('panel.summary.gap')}</dt>
                    <dd className="numeral text-ink">{formatNumber(org.gapToTarget, locale, 2)}</dd>
                </div>
                {scl !== null ? (
                    <div>
                        <dt className="text-xs text-muted-foreground">{t('panel.summary.scl')}</dt>
                        <dd className="numeral text-ink">{scl}</dd>
                    </div>
                ) : null}
            </dl>
        </section>
    );
}

function DecisionDialog({
    row,
    assessment,
    rationaleMin,
    onClose,
}: {
    row: Row;
    assessment: string;
    rationaleMin: number;
    onClose: () => void;
}) {
    const t = useT();
    const locale = useLocale();
    const form = useForm({
        kind: row.decision?.kind ?? 'CONFIRMED',
        value: row.decision?.value !== null && row.decision?.value !== undefined ? String(row.decision.value) : '',
        rationale: row.decision?.rationale ?? '',
    });
    return (
        <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
            <DialogContent className="max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('panel.decision.title', { code: row.code })}</DialogTitle>
                    <DialogDescription>
                        {t('panel.decision.engineValue', { value: row.final === null ? '' : formatNumber(row.final, locale, 2) })}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.transform((data) => ({ ...data, value: data.kind === 'ADJUSTED' ? Number(data.value) : null }));
                        form.put(PanelController.decide.url({ assessment, code: row.code }), {
                            preserveScroll: true,
                            onSuccess: onClose,
                        });
                    }}
                >
                    <fieldset className="space-y-2">
                        {(['CONFIRMED', 'ADJUSTED'] as const).map((kind) => (
                            <label key={kind} className="flex items-center gap-2 text-sm">
                                <input
                                    type="radio"
                                    name="kind"
                                    className="size-4 accent-maroon"
                                    checked={form.data.kind === kind}
                                    onChange={() => form.setData('kind', kind)}
                                />
                                {kind === 'ADJUSTED' ? t('panel.decision.adjust') : t('panel.decision.confirm')}
                            </label>
                        ))}
                    </fieldset>
                    {form.data.kind === 'ADJUSTED' ? (
                        <Field id="panel-value" label={t('panel.decision.value')} error={form.errors.value}>
                            <Input
                                id="panel-value"
                                type="number"
                                inputMode="decimal"
                                min={1}
                                max={5}
                                step="0.01"
                                required
                                value={form.data.value}
                                onChange={(e) => form.setData('value', e.target.value)}
                            />
                        </Field>
                    ) : null}
                    <Field
                        id="panel-rationale"
                        label={t('panel.decision.rationale')}
                        hint={t('panel.decision.rationaleHint', { min: rationaleMin })}
                        error={form.errors.rationale}
                    >
                        <TextArea
                            id="panel-rationale"
                            rows={4}
                            required
                            minLength={rationaleMin}
                            maxLength={4000}
                            value={form.data.rationale}
                            onChange={(e) => form.setData('rationale', e.target.value)}
                        />
                    </Field>
                    <div className="flex flex-wrap justify-between gap-2">
                        {row.decision ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                    router.delete(PanelController.withdraw.url({ assessment, code: row.code }), {
                                        preserveScroll: true,
                                        onSuccess: onClose,
                                    })
                                }
                            >
                                {t('panel.decision.withdraw')}
                            </Button>
                        ) : (
                            <span />
                        )}
                        <span className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                {t('panel.decision.cancel')}
                            </Button>
                            <Button type="submit" disabled={form.processing} data-testid="decision-save">
                                {t('panel.decision.save')}
                            </Button>
                        </span>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
