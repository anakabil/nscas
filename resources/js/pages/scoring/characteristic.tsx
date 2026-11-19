import { Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Eye } from 'lucide-react';
import ScoringController from '@/actions/App/Http/Controllers/Scoring/ScoringController';
import { CollectionShell, formatPercent, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, NativeSelect, Panel, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/i18n';

type Group = 'MANAGEMENT' | 'SUPERVISORY' | 'FIELD';
type Rating = {
    assessorId: number;
    assessor: string | null;
    level: number;
    rationale: string;
    evidenceIds: string[];
    observationIds: string[];
    updatedAt: string;
};
type Workspace = {
    id: string;
    code: string;
    name: string;
    nameEn: string | null;
    contextual: boolean;
    perception: {
        survey?: number | null;
        answered?: number;
        dontKnowShare?: number | null;
        groups?: Record<Group, { value: number | null; n: number; suppressed: boolean }>;
        selfAssessment?: { mean: number | null; n: number };
    };
    evidence: { id: string; title: string; fileName: string; version: number; unit: string | null; url: string }[];
    captures: {
        id: string;
        window: string | null;
        item: string;
        capturedAt: string;
        outside: boolean;
        note: string | null;
        url: string;
    }[];
    validation: { label: string; type: string; mean: number; raters: number }[];
    review: { note: string | null; by: string | null; at: string } | null;
    own: Rating | null;
    others: Rating[];
    hidden: number;
};
type Props = CollectionCommon & {
    canRate: boolean;
    ratingLevels: number[];
    rationaleMin: number;
    characteristic: Workspace;
    codes: string[];
};

const GROUPS: Group[] = ['MANAGEMENT', 'SUPERVISORY', 'FIELD'];

/** Ruang kerja nilai bukti satu karakteristik: sumber data di satu layar, lalu nilai milik asesor ini. */
export default function ScoringCharacteristic(props: Props) {
    const t = useT();
    const locale = useLocale();
    const c = props.characteristic;
    const assessment = props.assessment.id;
    const at = props.codes.indexOf(c.code);
    const previous = at > 0 ? props.codes[at - 1] : null;
    const next = at >= 0 && at < props.codes.length - 1 ? props.codes[at + 1] : null;
    const form = useForm({
        level: c.own ? String(c.own.level) : '',
        rationale: c.own?.rationale ?? '',
        evidenceIds: c.own?.evidenceIds ?? [],
        observationIds: c.own?.observationIds ?? [],
    });
    const errors = form.errors as Record<string, string | undefined>;
    const toggle = (key: 'evidenceIds' | 'observationIds', id: string, on: boolean) =>
        form.setData(key, on ? [...form.data[key], id] : form.data[key].filter((x) => x !== id));
    const p = c.perception;
    const number = (v: number | null | undefined) =>
        v === null || v === undefined ? t('scoringItem.perception.none') : formatNumber(v, locale, 2);

    return (
        <CollectionShell
            module="scoring"
            common={props}
            canEdit={props.canRate}
            showWindow={false}
            notice={props.canRate ? null : t('scoring.closed')}
        >
            <nav className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    href={ScoringController.index.url(assessment)}
                    className="inline-flex items-center gap-1.5 text-sm text-charcoal hover:text-ink"
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    {t('scoringItem.back')}
                </Link>
                <span className="flex gap-2">
                    {previous ? (
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={ScoringController.show.url({ assessment, code: previous })}
                                aria-label={`${t('scoringItem.previous')} ${previous}`}
                            >
                                <ChevronLeft aria-hidden />
                                {previous}
                            </Link>
                        </Button>
                    ) : null}
                    {next ? (
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={ScoringController.show.url({ assessment, code: next })}
                                aria-label={`${t('scoringItem.next')} ${next}`}
                            >
                                {next}
                                <ChevronRight aria-hidden />
                            </Link>
                        </Button>
                    ) : null}
                </span>
            </nav>
            <h3 className="font-display text-2xl leading-tight text-ink" data-testid="characteristic-title">
                {c.code} {locale === 'en' && c.nameEn ? c.nameEn : c.name}
            </h3>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="min-w-0 space-y-8">
                    <Panel title={t('scoringItem.perception.title')}>
                        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                            <div className="min-w-0">
                                <dt className="text-xs text-muted-foreground">{t('scoringItem.perception.survey')}</dt>
                                <dd className="numeral text-lg text-ink">{number(p.survey)}</dd>
                                <dd className="text-xs text-muted-foreground">
                                    {t('scoringItem.perception.answered', { count: p.answered ?? 0 })}
                                </dd>
                            </div>
                            {GROUPS.map((g) => (
                                <div key={g} className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">{t(`groupsShort.${g}`)}</dt>
                                    <dd className="numeral text-lg text-ink">
                                        {p.groups?.[g]?.value === null || p.groups?.[g] === undefined ? (
                                            <span className="text-xs text-muted-foreground">{t('hiddenCell')}</span>
                                        ) : (
                                            formatNumber(p.groups[g].value ?? 0, locale, 2)
                                        )}
                                    </dd>
                                </div>
                            ))}
                            <div className="min-w-0">
                                <dt className="text-xs text-muted-foreground">{t('scoringItem.perception.selfAssessment')}</dt>
                                <dd className="numeral text-lg text-ink">{number(p.selfAssessment?.mean)}</dd>
                                <dd className="text-xs text-muted-foreground">
                                    {t('scoringItem.perception.selfCount', { count: p.selfAssessment?.n ?? 0 })}
                                </dd>
                            </div>
                            <div className="min-w-0">
                                <dt className="text-xs text-muted-foreground">{t('scoringItem.perception.dontKnow')}</dt>
                                <dd className="numeral text-lg text-ink">
                                    {p.dontKnowShare === null || p.dontKnowShare === undefined
                                        ? ''
                                        : formatPercent(p.dontKnowShare, locale, 0)}
                                </dd>
                            </div>
                        </dl>
                    </Panel>

                    <Panel title={t('scoringItem.validation.title')}>
                        {c.validation.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('scoringItem.validation.empty')}</p>
                        ) : (
                            <ul className="divide-y divide-border text-sm" data-testid="workspace-validation">
                                {c.validation.map((v, i) => (
                                    <li key={i} className="flex items-center gap-3 py-2">
                                        <span className="min-w-0 flex-1 text-ink">{v.label}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {t('scoringItem.validation.raters', { count: v.raters })}
                                        </span>
                                        <span className="numeral w-10 text-right font-medium text-ink">
                                            {formatNumber(v.mean, locale, 1)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <Panel title={t('scoringItem.evidence.title')}>
                        {c.review ? (
                            <p className="text-xs text-success">
                                {t('scoringItem.reviewed', { name: c.review.by ?? '', date: formatWib(c.review.at, locale) })}
                                {c.review.note ? ` ${c.review.note}` : ''}
                            </p>
                        ) : null}
                        {c.evidence.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('scoringItem.evidence.empty')}</p>
                        ) : (
                            <ul className="divide-y divide-border text-sm" data-testid="workspace-evidence">
                                {c.evidence.map((e) => (
                                    <li key={e.id} className="flex items-center gap-3 py-2">
                                        {props.canRate ? (
                                            <input
                                                type="checkbox"
                                                className="size-4 shrink-0 accent-maroon"
                                                aria-label={`${t('scoringItem.basis')} ${e.title}`}
                                                checked={form.data.evidenceIds.includes(e.id)}
                                                onChange={(ev) => toggle('evidenceIds', e.id, ev.target.checked)}
                                            />
                                        ) : null}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-ink">{e.title}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {t('scoringItem.evidence.version', { version: e.version })}
                                                {e.unit ? `, ${e.unit}` : ''}
                                            </span>
                                        </span>
                                        <Button asChild size="icon" variant="ghost" className="size-8 shrink-0">
                                            <a
                                                href={e.url}
                                                aria-label={`${t('scoringItem.evidence.download')} ${e.title}`}
                                                title={t('scoringItem.evidence.download')}
                                            >
                                                <Download aria-hidden />
                                            </a>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <Panel title={t('scoringItem.observations.title')}>
                        {c.captures.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('scoringItem.observations.empty')}</p>
                        ) : (
                            <ul
                                className="max-h-80 divide-y divide-border overflow-y-auto text-sm"
                                data-testid="workspace-captures"
                            >
                                {c.captures.map((o) => (
                                    <li key={o.id} className="flex items-center gap-3 py-2">
                                        {props.canRate ? (
                                            <input
                                                type="checkbox"
                                                className="size-4 shrink-0 accent-maroon"
                                                aria-label={`${t('scoringItem.basis')} ${o.item} ${o.window ?? ''}`}
                                                checked={form.data.observationIds.includes(o.id)}
                                                onChange={(ev) => toggle('observationIds', o.id, ev.target.checked)}
                                            />
                                        ) : null}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-ink">
                                                {o.item} {o.window}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                {formatWib(o.capturedAt, locale)}
                                                {o.outside ? `, ${t('scoringItem.observations.outside')}` : ''}
                                            </span>
                                        </span>
                                        <Button asChild size="icon" variant="ghost" className="size-8 shrink-0">
                                            <a
                                                href={o.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={t('scoringItem.observations.view')}
                                                title={t('scoringItem.observations.view')}
                                            >
                                                <Eye aria-hidden />
                                            </a>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.transform((data) => ({ ...data, level: Number(data.level) }));
                            form.put(ScoringController.rate.url({ assessment, characteristic: c.id }), { preserveScroll: true });
                        }}
                    >
                        <Panel title={t('scoringItem.form.title')} className="border-gold/60">
                            <Field id="rating-level" label={t('scoringItem.form.level')} error={errors.level}>
                                <NativeSelect
                                    id="rating-level"
                                    required
                                    disabled={!props.canRate}
                                    value={form.data.level}
                                    onChange={(e) => form.setData('level', e.target.value)}
                                >
                                    <option value="">{t('scoringItem.form.choose')}</option>
                                    {props.ratingLevels.map((level) => (
                                        <option key={level} value={String(level)}>
                                            {formatNumber(level, locale, 1)}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field
                                id="rating-rationale"
                                label={t('scoringItem.form.rationale')}
                                hint={t('scoringItem.form.rationaleHint', { min: props.rationaleMin })}
                                error={errors.rationale}
                            >
                                <TextArea
                                    id="rating-rationale"
                                    rows={6}
                                    required
                                    minLength={props.rationaleMin}
                                    maxLength={4000}
                                    disabled={!props.canRate}
                                    value={form.data.rationale}
                                    onChange={(e) => form.setData('rationale', e.target.value)}
                                />
                            </Field>
                            <FormError message={errors.evidenceIds ?? errors.observationIds ?? errors.form} />
                            {c.own ? (
                                <p className="text-xs text-muted-foreground">
                                    {t('scoringItem.form.saved', { date: formatWib(c.own.updatedAt, locale) })}
                                </p>
                            ) : null}
                            {props.canRate ? (
                                <Button type="submit" disabled={form.processing} data-testid="rating-submit">
                                    {t('scoringItem.form.save')}
                                </Button>
                            ) : null}
                        </Panel>
                    </form>

                    <Panel title={t('scoringItem.others.title')}>
                        {c.hidden > 0 ? (
                            <p className="text-sm text-muted-foreground" data-testid="others-hidden">
                                {t('scoringItem.others.hidden', { count: c.hidden })}
                            </p>
                        ) : c.others.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('scoringItem.others.empty')}</p>
                        ) : (
                            <ul className="space-y-3" data-testid="others">
                                {c.others.map((o) => (
                                    <li key={o.assessorId} className="text-sm">
                                        <p className="flex items-baseline justify-between gap-3">
                                            <span className="font-medium text-ink">{o.assessor}</span>
                                            <span className="numeral font-semibold text-ink">
                                                {formatNumber(o.level, locale, 1)}
                                            </span>
                                        </p>
                                        <p className="text-charcoal">{o.rationale}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </CollectionShell>
    );
}
