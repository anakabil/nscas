import { Link, useForm } from '@inertiajs/react';
import SamplingController from '@/actions/App/Http/Controllers/Setup/SamplingController';
import { Field, FormError, Panel, SetupShell, formatDateTime, formatNumber } from '@/components/nscas/setup-shell';
import type { SetupCommon } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

type Settings = {
    z: number;
    marginOfError: number;
    proportion: number;
    minParticipationPerStratum: number;
    sclInterviewFactorManagement: number;
    sclInterviewFactorOperational: number;
    sclProjectFactor: number;
    fgdMaxParticipantsPerSession: number;
};

type PlanResult = {
    inputs: { M: number; projects: number; locations: number; z: number; e: number; p: number; minParticipation: number };
    sclMinimumInterviewManagement: number;
    sclMinimumInterviewOperational: number;
    sclMinimumInterviewTotal: number;
    slovin: number;
    cochranInitial: number;
    cochranCorrected: number;
    recommendedSurvey: number;
    projectsToVisit: number;
    locationsToVisit: number;
    strata: { code: string; name: string; population: number; proportion: number; surveyTarget: number }[];
    surveyTargetTotal: number;
};

type Props = SetupCommon & {
    strata: { code: string; name: string; population: number }[];
    settings: Settings | null;
    suggested: { projects: number; locations: number };
    plan: { projects: number; locations: number; computedAt: string; result: PlanResult } | null;
};

/** Halaman kalkulator sampel (tahap 1). Perhitungan selalu di server; halaman ini menampilkan masukan dan hasilnya. */
export default function SetupSampling(props: Props) {
    const t = useT();
    const locale = useLocale();
    const form = useForm({
        projects: props.plan?.projects ?? props.suggested.projects,
        locations: props.plan?.locations ?? props.suggested.locations,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const disabled = !props.canEdit || form.processing;
    const workers = props.strata.reduce((sum, stratum) => sum + stratum.population, 0);
    const strataHref = props.planning.find((item) => item.key === 'strata')?.href;
    const n = (value: number, digits = 0) => formatNumber(value, locale, digits);
    const percent = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const result = props.plan?.result ?? null;

    const minimumRows: { key: string; value: string }[] = result
        ? [
              { key: 'interviewManagement', value: n(result.sclMinimumInterviewManagement) },
              { key: 'interviewOperational', value: n(result.sclMinimumInterviewOperational) },
              { key: 'interviewTotal', value: n(result.sclMinimumInterviewTotal) },
              { key: 'slovin', value: n(result.slovin) },
              { key: 'cochranInitial', value: n(result.cochranInitial, 1) },
              { key: 'cochranCorrected', value: n(result.cochranCorrected) },
              { key: 'recommended', value: n(result.recommendedSurvey) },
              { key: 'projectsToVisit', value: n(result.projectsToVisit) },
              { key: 'locationsToVisit', value: n(result.locationsToVisit) },
          ]
        : [];

    return (
        <SetupShell module="sampling" common={props}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('sampling.intro')}</p>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(SamplingController.store.url(props.assessment.id), { preserveScroll: true });
                }}
            >
                <Panel title={t('sampling.inputs')}>
                    <FormError message={errors.form} />
                    {workers === 0 ? (
                        <p
                            role="note"
                            className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"
                        >
                            {t('sampling.noPopulation')}{' '}
                            {strataHref ? (
                                <Link href={strataHref} className="font-semibold text-ink underline underline-offset-2">
                                    {t('modules.strata.title')}
                                </Link>
                            ) : null}
                        </p>
                    ) : null}
                    <div className="grid gap-5 sm:grid-cols-3">
                        <Field id="workers" label={t('sampling.workers')} hint={t('sampling.workersHint')}>
                            <Input id="workers" value={n(workers)} readOnly disabled className="numeral h-10 bg-muted" />
                        </Field>
                        <Field id="projects" label={t('sampling.projects')} error={errors.projects}>
                            <Input
                                id="projects"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={form.data.projects}
                                onChange={(e) => form.setData('projects', Number(e.target.value))}
                                disabled={disabled}
                                className="numeral h-10 bg-card"
                            />
                        </Field>
                        <Field id="locations" label={t('sampling.locations')} error={errors.locations}>
                            <Input
                                id="locations"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={form.data.locations}
                                onChange={(e) => form.setData('locations', Number(e.target.value))}
                                disabled={disabled}
                                className="numeral h-10 bg-card"
                            />
                        </Field>
                    </div>
                    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                        <p>
                            {t('sampling.suggested', {
                                projects: n(props.suggested.projects),
                                locations: n(props.suggested.locations),
                            })}
                        </p>
                        {props.settings ? (
                            <p>
                                {t('sampling.settings', {
                                    z: n(props.settings.z, 2),
                                    e: n(props.settings.marginOfError, 2),
                                    p: n(props.settings.proportion, 2),
                                    min: percent.format(props.settings.minParticipationPerStratum),
                                })}
                            </p>
                        ) : null}
                    </div>
                    {props.canEdit ? (
                        <div className="flex justify-end">
                            <Button type="submit" disabled={form.processing || workers === 0}>
                                {form.processing ? t('common.saving') : t(props.plan ? 'sampling.recalculate' : 'sampling.save')}
                            </Button>
                        </div>
                    ) : null}
                </Panel>
            </form>

            {props.plan && result ? (
                <>
                    <p role="status" className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                        {t('sampling.lastSaved', {
                            time: formatDateTime(props.plan.computedAt, locale),
                            target: n(result.surveyTargetTotal),
                        })}
                    </p>

                    <Panel title={t('sampling.minimumTitle')}>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[32rem] text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('sampling.item')}
                                        </th>
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('sampling.formula')}
                                        </th>
                                        <th scope="col" className="py-2 text-right font-medium">
                                            {t('sampling.result')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {minimumRows.map((row) => (
                                        <tr
                                            key={row.key}
                                            className={
                                                row.key === 'recommended'
                                                    ? 'border-b border-border/60 bg-muted/60 font-semibold text-ink'
                                                    : 'border-b border-border/60 last:border-0'
                                            }
                                        >
                                            <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                                                {t(`sampling.${row.key}`)}
                                            </th>
                                            <td className="py-2.5 pr-4 text-muted-foreground">
                                                {t(`sampling.formulas.${row.key}`)}
                                            </td>
                                            <td className="numeral py-2.5 text-right">{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    <Panel title={t('sampling.strataTitle')}>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[34rem] text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('strata.code')}
                                        </th>
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('strata.name')}
                                        </th>
                                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                                            {t('strata.population')}
                                        </th>
                                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                                            {t('sampling.proportionCol')}
                                        </th>
                                        <th scope="col" className="py-2 text-right font-medium">
                                            {t('sampling.target')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.strata.map((stratum) => (
                                        <tr key={stratum.code} className="border-b border-border/60">
                                            <td className="numeral py-2.5 pr-4 font-semibold text-gold-deep">{stratum.code}</td>
                                            <td className="py-2.5 pr-4">{stratum.name}</td>
                                            <td className="numeral py-2.5 pr-4 text-right">{n(stratum.population)}</td>
                                            <td className="numeral py-2.5 pr-4 text-right">
                                                {percent.format(stratum.proportion)}
                                            </td>
                                            <td className="numeral py-2.5 text-right">{n(stratum.surveyTarget)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-semibold text-ink">
                                        <th scope="row" colSpan={2} className="py-2.5 pr-4 text-left">
                                            {t('sampling.total')}
                                        </th>
                                        <td className="numeral py-2.5 pr-4 text-right">{n(result.inputs.M)}</td>
                                        <td className="py-2.5 pr-4" />
                                        <td className="numeral py-2.5 text-right">{n(result.surveyTargetTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                            <p>
                                {t('sampling.target')}: {t('sampling.formulas.stratumTarget')}.
                            </p>
                            <p>{t('sampling.roundingNote')}</p>
                        </div>
                    </Panel>
                </>
            ) : (
                <p role="note" className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                    {t('sampling.notSaved')}
                </p>
            )}
        </SetupShell>
    );
}
