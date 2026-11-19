import { useForm } from '@inertiajs/react';
import DetailsController from '@/actions/App/Http/Controllers/Setup/DetailsController';
import { Field, FormError, NativeSelect, Panel, SetupShell } from '@/components/nscas/setup-shell';
import type { SetupCommon } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n';

type Props = SetupCommon & {
    details: {
        name: string;
        scopeType: string;
        periodStart: string;
        periodEnd: string;
        targetLevel: number;
        instrumentVersionId: string | null;
    };
    instrumentVersions: { id: string; code: string }[];
};

export const SCOPES = ['CORPORATE', 'DIVISION', 'PROJECT'] as const;
export const LEVELS = [1, 2, 3, 4, 5] as const;

/** Halaman rincian dan lingkup asesmen (tahap 1). */
export default function SetupDetails(props: Props) {
    const t = useT();
    const form = useForm({
        name: props.details.name,
        scope_type: props.details.scopeType,
        period_start: props.details.periodStart,
        period_end: props.details.periodEnd,
        target_level: props.details.targetLevel,
        instrument_version_id: props.details.instrumentVersionId ?? '',
    });
    const disabled = !props.canEdit || form.processing;
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <SetupShell module="details" common={props}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('details.intro')}</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.put(DetailsController.update.url(props.assessment.id), { preserveScroll: true });
                }}
            >
                <Panel>
                    <FormError message={errors.form} />
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field id="name" label={t('details.name')} error={errors.name} className="sm:col-span-2">
                            <Input
                                id="name"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                disabled={disabled}
                                required
                            />
                        </Field>
                        <Field id="scope_type" label={t('details.scopeType')} error={errors.scope_type}>
                            <NativeSelect
                                id="scope_type"
                                value={form.data.scope_type}
                                onChange={(e) => form.setData('scope_type', e.target.value)}
                                disabled={disabled}
                            >
                                {SCOPES.map((scope) => (
                                    <option key={scope} value={scope}>
                                        {t(`scopes.${scope}`)}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field id="target_level" label={t('details.targetLevel')} error={errors.target_level}>
                            <NativeSelect
                                id="target_level"
                                value={form.data.target_level}
                                onChange={(e) => form.setData('target_level', Number(e.target.value))}
                                disabled={disabled}
                            >
                                {LEVELS.map((level) => (
                                    <option key={level} value={level}>
                                        {t(`levels.${level}`)}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field id="period_start" label={t('details.periodStart')} error={errors.period_start}>
                            <Input
                                id="period_start"
                                type="date"
                                value={form.data.period_start}
                                onChange={(e) => form.setData('period_start', e.target.value)}
                                disabled={disabled}
                                required
                            />
                        </Field>
                        <Field id="period_end" label={t('details.periodEnd')} error={errors.period_end}>
                            <Input
                                id="period_end"
                                type="date"
                                value={form.data.period_end}
                                onChange={(e) => form.setData('period_end', e.target.value)}
                                disabled={disabled}
                                required
                            />
                        </Field>
                        <Field
                            id="instrument_version_id"
                            label={t('details.instrumentVersion')}
                            error={errors.instrument_version_id}
                        >
                            <NativeSelect
                                id="instrument_version_id"
                                value={form.data.instrument_version_id}
                                onChange={(e) => form.setData('instrument_version_id', e.target.value)}
                                disabled={disabled}
                            >
                                {props.instrumentVersions.map((version) => (
                                    <option key={version.id} value={version.id}>
                                        {version.code}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                    </div>
                    {props.canEdit ? (
                        <div className="flex justify-end">
                            <Button type="submit" disabled={form.processing}>
                                {form.processing ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    ) : null}
                </Panel>
            </form>
        </SetupShell>
    );
}
