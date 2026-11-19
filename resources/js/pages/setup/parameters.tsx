import { useForm } from '@inertiajs/react';
import { TriangleAlert } from 'lucide-react';
import ParameterController from '@/actions/App/Http/Controllers/Setup/ParameterController';
import { Field, FormError, NativeSelect, Panel, SetupShell, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import type { SetupCommon } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';

type SclRow = { step: number; minWeightedAverage: number; minPerAspect: number };

type Parameters = {
    layerWeights: { perception: number; evidence: number; validation: number };
    selfAssessmentWeightInPerception: number;
    divergenceThreshold: number;
    consolidation: { maxAspectBelowLevel: number; maxCharacteristicBelowLevel: number };
    perceptionGapAttention: number;
    assessorDisagreementFlag: number;
    sclThresholds: SclRow[];
    quality: { cronbachAlphaMin: number; rwgMin: number; minRespondentsPerReportCell: number };
    sampling: { z: number; marginOfError: number; proportion: number; minParticipationPerStratum: number };
};

type DpaStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SIGNED';

type Props = SetupCommon & {
    parameters: Parameters;
    aspectWeights: { code: string; name: string; weight: number }[];
    retentionMonths: number;
    consent: { id: string; en: string };
    consentTemplates: { id: string; en: string };
    dataLocation: string;
    dpa: { status: DpaStatus; reference: string | null; signedOn: string | null };
};

/** Bentuk isian formulir: angka disimpan sebagai teks agar koma desimal dapat diketik apa adanya. */
type ParameterFields = {
    layerWeights: { perception: string; evidence: string; validation: string };
    selfAssessmentWeightInPerception: string;
    divergenceThreshold: string;
    consolidation: { maxAspectBelowLevel: string; maxCharacteristicBelowLevel: string };
    perceptionGapAttention: string;
    assessorDisagreementFlag: string;
    sclThresholds: { step: number; minWeightedAverage: string; minPerAspect: string }[];
    quality: { cronbachAlphaMin: string; rwgMin: string; minRespondentsPerReportCell: string };
    sampling: { z: string; marginOfError: string; proportion: string; minParticipationPerStratum: string };
};

const DPA_STATUSES: DpaStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'SIGNED'];

/** Angka sebagai teks isian: koma desimal untuk bahasa Indonesia, titik untuk bahasa Inggris. */
function toField(value: number, locale: Locale): string {
    const text = String(value);
    return locale === 'id' ? text.replace('.', ',') : text;
}

/** Teks isian menjadi angka; menerima koma atau titik desimal. NaN bila tidak dapat dibaca. */
function parseDecimal(value: string): number {
    const text = value.trim().replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

function toFields(p: Parameters, locale: Locale): ParameterFields {
    const f = (value: number) => toField(value, locale);
    return {
        layerWeights: {
            perception: f(p.layerWeights.perception),
            evidence: f(p.layerWeights.evidence),
            validation: f(p.layerWeights.validation),
        },
        selfAssessmentWeightInPerception: f(p.selfAssessmentWeightInPerception),
        divergenceThreshold: f(p.divergenceThreshold),
        consolidation: {
            maxAspectBelowLevel: f(p.consolidation.maxAspectBelowLevel),
            maxCharacteristicBelowLevel: f(p.consolidation.maxCharacteristicBelowLevel),
        },
        perceptionGapAttention: f(p.perceptionGapAttention),
        assessorDisagreementFlag: f(p.assessorDisagreementFlag),
        sclThresholds: p.sclThresholds.map((row) => ({
            step: row.step,
            minWeightedAverage: f(row.minWeightedAverage),
            minPerAspect: f(row.minPerAspect),
        })),
        quality: {
            cronbachAlphaMin: f(p.quality.cronbachAlphaMin),
            rwgMin: f(p.quality.rwgMin),
            minRespondentsPerReportCell: String(p.quality.minRespondentsPerReportCell),
        },
        sampling: {
            z: f(p.sampling.z),
            marginOfError: f(p.sampling.marginOfError),
            proportion: f(p.sampling.proportion),
            minParticipationPerStratum: f(p.sampling.minParticipationPerStratum),
        },
    };
}

/** Isian angka desimal: papan ketik angka di telepon, koma atau titik diterima. */
function DecimalInput({
    id,
    value,
    onChange,
    disabled,
    invalid,
    integer = false,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    invalid?: boolean;
    integer?: boolean;
}) {
    return (
        <Input
            id={id}
            type="text"
            inputMode={integer ? 'numeric' : 'decimal'}
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className="numeral h-10 bg-card"
        />
    );
}

/** Halaman parameter asesmen, teks persetujuan responden, dan perjanjian pemrosesan data (tahap 1). */
export default function SetupParameters(props: Props) {
    const t = useT();
    const locale = useLocale();
    const form = useForm({
        parameters: toFields(props.parameters, locale),
        consent_text_id: props.consent.id,
        consent_text_en: props.consent.en,
        dpa_status: props.dpa.status,
        dpa_reference: props.dpa.reference ?? '',
        dpa_signed_on: props.dpa.signedOn ?? '',
    });
    const disabled = !props.canEdit || form.processing;
    const errors = form.errors as Record<string, string | undefined>;
    const p = form.data.parameters;

    /** Mengubah satu isian parameter tanpa menyentuh isian lain. */
    const setParameters = (update: (current: ParameterFields) => ParameterFields) =>
        form.setData((data) => ({ ...data, parameters: update(data.parameters) }));

    const weightSum =
        parseDecimal(p.layerWeights.perception) + parseDecimal(p.layerWeights.evidence) + parseDecimal(p.layerWeights.validation);
    const weightsValid = Number.isFinite(weightSum) && Math.abs(weightSum - 1) <= 1e-6;
    const percent = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const consentMissingLocation = props.dataLocation !== '' && !form.data.consent_text_id.includes(props.dataLocation);

    /** Satu isian angka beserta label dan galatnya. */
    const decimalField = (
        id: string,
        label: string,
        value: string,
        onChange: (value: string) => void,
        errorKey: string,
        hint?: string,
        integer = false,
    ) => (
        <Field id={id} label={label} hint={hint} error={errors[errorKey]}>
            <DecimalInput
                id={id}
                value={value}
                onChange={onChange}
                disabled={disabled}
                invalid={Boolean(errors[errorKey])}
                integer={integer}
            />
        </Field>
    );

    return (
        <SetupShell module="parameters" common={props}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('parameters.intro')}</p>
            <form
                className="space-y-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.put(ParameterController.update.url(props.assessment.id), { preserveScroll: true });
                }}
            >
                <FormError message={errors.form} />

                <Panel title={t('parameters.layerWeights')} hint={props.canEdit ? t('common.decimalHint') : undefined}>
                    <div className="grid gap-5 sm:grid-cols-3">
                        {(['perception', 'evidence', 'validation'] as const).map((layer) =>
                            decimalField(
                                `layer-${layer}`,
                                t(`parameters.${layer}`),
                                p.layerWeights[layer],
                                (value) => setParameters((c) => ({ ...c, layerWeights: { ...c.layerWeights, [layer]: value } })),
                                `parameters.layerWeights.${layer}`,
                            ),
                        )}
                    </div>
                    <p
                        className={cn(
                            'numeral rounded-md px-3 py-2 text-sm',
                            weightsValid ? 'bg-muted text-muted-foreground' : 'bg-destructive/5 text-destructive',
                        )}
                        aria-live="polite"
                    >
                        {t('parameters.layerWeightsHint', {
                            sum: Number.isFinite(weightSum) ? formatNumber(weightSum, locale, 2) : '?',
                        })}
                    </p>
                    {errors['parameters.layerWeights'] ? (
                        <p className="text-sm text-destructive" role="alert">
                            {errors['parameters.layerWeights']}
                        </p>
                    ) : null}
                    {decimalField(
                        'self-assessment-weight',
                        t('parameters.selfAssessmentWeight'),
                        p.selfAssessmentWeightInPerception,
                        (value) => setParameters((c) => ({ ...c, selfAssessmentWeightInPerception: value })),
                        'parameters.selfAssessmentWeightInPerception',
                        t('parameters.selfAssessmentHint'),
                    )}
                </Panel>

                <Panel title={t('parameters.thresholds')}>
                    <div className="grid gap-5 sm:grid-cols-2">
                        {decimalField(
                            'divergence-threshold',
                            t('parameters.divergenceThreshold'),
                            p.divergenceThreshold,
                            (value) => setParameters((c) => ({ ...c, divergenceThreshold: value })),
                            'parameters.divergenceThreshold',
                        )}
                        {decimalField(
                            'max-aspect-below',
                            t('parameters.maxAspectBelowLevel'),
                            p.consolidation.maxAspectBelowLevel,
                            (value) =>
                                setParameters((c) => ({
                                    ...c,
                                    consolidation: { ...c.consolidation, maxAspectBelowLevel: value },
                                })),
                            'parameters.consolidation.maxAspectBelowLevel',
                        )}
                        {decimalField(
                            'max-characteristic-below',
                            t('parameters.maxCharacteristicBelowLevel'),
                            p.consolidation.maxCharacteristicBelowLevel,
                            (value) =>
                                setParameters((c) => ({
                                    ...c,
                                    consolidation: { ...c.consolidation, maxCharacteristicBelowLevel: value },
                                })),
                            'parameters.consolidation.maxCharacteristicBelowLevel',
                        )}
                        {decimalField(
                            'perception-gap',
                            t('parameters.perceptionGapAttention'),
                            p.perceptionGapAttention,
                            (value) => setParameters((c) => ({ ...c, perceptionGapAttention: value })),
                            'parameters.perceptionGapAttention',
                        )}
                        {decimalField(
                            'assessor-disagreement',
                            t('parameters.assessorDisagreementFlag'),
                            p.assessorDisagreementFlag,
                            (value) => setParameters((c) => ({ ...c, assessorDisagreementFlag: value })),
                            'parameters.assessorDisagreementFlag',
                        )}
                    </div>
                </Panel>

                <Panel title={t('parameters.sclTitle')} hint={t('parameters.sclHint')}>
                    <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[26rem] text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                    <th scope="col" className="py-2 pr-4 font-medium">
                                        {t('parameters.step')}
                                    </th>
                                    <th scope="col" className="py-2 pr-4 font-medium">
                                        {t('parameters.minWeightedAverage')}
                                    </th>
                                    <th scope="col" className="py-2 font-medium">
                                        {t('parameters.minPerAspect')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {p.sclThresholds.map((row, index) => (
                                    <tr key={row.step} className="border-b border-border/60 last:border-0">
                                        <th scope="row" className="numeral py-2.5 pr-4 text-left font-semibold text-ink">
                                            {row.step}
                                        </th>
                                        <td className="py-2.5 pr-4">
                                            <DecimalInput
                                                id={`scl-${row.step}-average`}
                                                value={row.minWeightedAverage}
                                                onChange={(value) =>
                                                    setParameters((c) => ({
                                                        ...c,
                                                        sclThresholds: c.sclThresholds.map((r, i) =>
                                                            i === index ? { ...r, minWeightedAverage: value } : r,
                                                        ),
                                                    }))
                                                }
                                                disabled={disabled}
                                                invalid={Boolean(errors[`parameters.sclThresholds.${index}.minWeightedAverage`])}
                                            />
                                        </td>
                                        <td className="py-2.5">
                                            <DecimalInput
                                                id={`scl-${row.step}-aspect`}
                                                value={row.minPerAspect}
                                                onChange={(value) =>
                                                    setParameters((c) => ({
                                                        ...c,
                                                        sclThresholds: c.sclThresholds.map((r, i) =>
                                                            i === index ? { ...r, minPerAspect: value } : r,
                                                        ),
                                                    }))
                                                }
                                                disabled={disabled}
                                                invalid={Boolean(errors[`parameters.sclThresholds.${index}.minPerAspect`])}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {Object.entries(errors)
                        .filter(([key]) => key.startsWith('parameters.sclThresholds'))
                        .map(([key, message]) => (
                            <p key={key} className="text-sm text-destructive" role="alert">
                                {message}
                            </p>
                        ))}
                </Panel>

                <Panel title={t('parameters.quality')}>
                    <div className="grid gap-5 sm:grid-cols-3">
                        {decimalField(
                            'cronbach-alpha',
                            t('parameters.cronbachAlphaMin'),
                            p.quality.cronbachAlphaMin,
                            (value) => setParameters((c) => ({ ...c, quality: { ...c.quality, cronbachAlphaMin: value } })),
                            'parameters.quality.cronbachAlphaMin',
                        )}
                        {decimalField(
                            'rwg',
                            t('parameters.rwgMin'),
                            p.quality.rwgMin,
                            (value) => setParameters((c) => ({ ...c, quality: { ...c.quality, rwgMin: value } })),
                            'parameters.quality.rwgMin',
                        )}
                        {decimalField(
                            'min-respondents',
                            t('parameters.minRespondents'),
                            p.quality.minRespondentsPerReportCell,
                            (value) =>
                                setParameters((c) => ({ ...c, quality: { ...c.quality, minRespondentsPerReportCell: value } })),
                            'parameters.quality.minRespondentsPerReportCell',
                            t('parameters.minRespondentsHint'),
                            true,
                        )}
                    </div>
                </Panel>

                <Panel title={t('parameters.sampling')} hint={t('parameters.samplingChangeNote')}>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {(
                            [
                                ['z', 'z'],
                                ['marginOfError', 'marginOfError'],
                                ['proportion', 'proportion'],
                                ['minParticipationPerStratum', 'minParticipation'],
                            ] as const
                        ).map(([key, label]) =>
                            decimalField(
                                `sampling-${key}`,
                                t(`parameters.${label}`),
                                p.sampling[key],
                                (value) => setParameters((c) => ({ ...c, sampling: { ...c.sampling, [key]: value } })),
                                `parameters.sampling.${key}`,
                            ),
                        )}
                    </div>
                </Panel>

                <Panel title={t('parameters.aspectWeights')} hint={t('parameters.aspectWeightsHint')}>
                    <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[20rem] text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                    <th scope="col" className="py-2 pr-4 font-medium">
                                        {t('parameters.aspect')}
                                    </th>
                                    <th scope="col" className="py-2 text-right font-medium">
                                        {t('parameters.weight')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.aspectWeights.map((aspect) => (
                                    <tr key={aspect.code} className="border-b border-border/60 last:border-0">
                                        <td className="py-2.5 pr-4">
                                            <span className="numeral mr-2 text-xs font-semibold text-gold-deep">
                                                {aspect.code}
                                            </span>
                                            {aspect.name}
                                        </td>
                                        <td className="numeral py-2.5 text-right">{percent.format(aspect.weight)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel title={t('parameters.consent')} hint={t('parameters.consentHint', { location: props.dataLocation })}>
                    {(['id', 'en'] as const).map((language) => {
                        const key = language === 'id' ? 'consent_text_id' : 'consent_text_en';
                        return (
                            <div key={language} className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label htmlFor={key} className="text-sm font-medium text-foreground">
                                        {t(language === 'id' ? 'parameters.consentId' : 'parameters.consentEn')}
                                    </label>
                                    {props.canEdit ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={disabled}
                                            onClick={() => form.setData(key, props.consentTemplates[language])}
                                        >
                                            {t('parameters.useTemplate')}
                                        </Button>
                                    ) : null}
                                </div>
                                <TextArea
                                    id={key}
                                    rows={6}
                                    value={form.data[key]}
                                    onChange={(e) => form.setData(key, e.target.value)}
                                    disabled={disabled}
                                    aria-invalid={Boolean(errors[key]) || undefined}
                                />
                                {errors[key] ? (
                                    <p className="text-sm text-destructive" role="alert">
                                        {errors[key]}
                                    </p>
                                ) : null}
                            </div>
                        );
                    })}
                    {consentMissingLocation ? (
                        <p
                            role="alert"
                            className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
                        >
                            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                            {t('parameters.consentMissingLocation', { location: props.dataLocation })}
                        </p>
                    ) : null}
                </Panel>

                <Panel title={t('parameters.dpa')} hint={t('parameters.dpaHint')}>
                    <div className="grid gap-5 sm:grid-cols-3">
                        <Field id="dpa_status" label={t('parameters.dpaStatus')} error={errors.dpa_status}>
                            <NativeSelect
                                id="dpa_status"
                                value={form.data.dpa_status}
                                onChange={(e) => form.setData('dpa_status', e.target.value as DpaStatus)}
                                disabled={disabled}
                            >
                                {DPA_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {t(`parameters.dpaStatuses.${status}`)}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field id="dpa_reference" label={t('parameters.dpaReference')} error={errors.dpa_reference}>
                            <Input
                                id="dpa_reference"
                                value={form.data.dpa_reference}
                                onChange={(e) => form.setData('dpa_reference', e.target.value)}
                                disabled={disabled}
                                className="h-10 bg-card"
                            />
                        </Field>
                        {form.data.dpa_status === 'SIGNED' ? (
                            <Field id="dpa_signed_on" label={t('parameters.dpaSignedOn')} error={errors.dpa_signed_on}>
                                <Input
                                    id="dpa_signed_on"
                                    type="date"
                                    value={form.data.dpa_signed_on}
                                    onChange={(e) => form.setData('dpa_signed_on', e.target.value)}
                                    disabled={disabled}
                                    className="h-10 bg-card"
                                />
                            </Field>
                        ) : null}
                    </div>
                </Panel>

                {props.canEdit ? (
                    <div className="flex justify-end">
                        <Button type="submit" disabled={form.processing}>
                            {form.processing ? t('common.saving') : t('parameters.save')}
                        </Button>
                    </div>
                ) : null}
            </form>
        </SetupShell>
    );
}
