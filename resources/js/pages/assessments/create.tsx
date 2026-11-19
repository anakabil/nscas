import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import NewAssessmentController from '@/actions/App/Http/Controllers/NewAssessmentController';
import { Container, SectionHeading } from '@/components/nscas/parts';
import { Field, FormError, NativeSelect, Panel } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n';
import { LEVELS, SCOPES } from '@/pages/setup/details';

type Props = {
    organizations: { id: string; name: string }[];
    instrumentVersions: { id: string; code: string }[];
    canManageOrganizations: boolean;
};

/** Asesmen baru oleh asesor utama (fase R1). Pembuatnya otomatis menjadi asesor utama asesmen itu. */
export default function NewAssessment({ organizations, instrumentVersions, canManageOrganizations }: Props) {
    const t = useT();
    const form = useForm({
        organization_id: '',
        name: '',
        scope_type: 'CORPORATE',
        period_start: '',
        period_end: '',
        target_level: 4,
        instrument_version_id: instrumentVersions[0]?.id ?? '',
    });
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <>
            <Head title={t('create.title')} />
            <Container className="space-y-8 py-12">
                <Link
                    href="/assessments"
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-ink"
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    {t('accountMenu.assessments.title')}
                </Link>
                <SectionHeading
                    eyebrow={t('accountMenu.newAssessment.title')}
                    title={t('create.title')}
                    intro={t('create.intro')}
                />
                {organizations.length === 0 ? (
                    <Panel>
                        <p className="text-sm text-foreground">
                            {canManageOrganizations ? t('create.noOrganization') : t('create.noOrganizationAsk')}
                        </p>
                        {canManageOrganizations ? (
                            <Link href="/organizations" className="text-sm font-semibold text-maroon hover:underline">
                                {t('create.openOrganizations')}
                            </Link>
                        ) : null}
                    </Panel>
                ) : (
                    <form
                        className="max-w-3xl"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post(NewAssessmentController.store.url());
                        }}
                    >
                        <Panel>
                            <FormError message={errors.form} />
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field
                                    id="organization_id"
                                    label={t('details.organization')}
                                    error={errors.organization_id}
                                    className="sm:col-span-2"
                                >
                                    <NativeSelect
                                        id="organization_id"
                                        value={form.data.organization_id}
                                        onChange={(e) => form.setData('organization_id', e.target.value)}
                                        required
                                    >
                                        <option value="">{t('create.chooseOrganization')}</option>
                                        {organizations.map((organization) => (
                                            <option key={organization.id} value={organization.id}>
                                                {organization.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field id="name" label={t('details.name')} error={errors.name} className="sm:col-span-2">
                                    <Input
                                        id="name"
                                        value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)}
                                        required
                                    />
                                </Field>
                                <Field id="scope_type" label={t('details.scopeType')} error={errors.scope_type}>
                                    <NativeSelect
                                        id="scope_type"
                                        value={form.data.scope_type}
                                        onChange={(e) => form.setData('scope_type', e.target.value)}
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
                                        required
                                    />
                                </Field>
                                <Field id="period_end" label={t('details.periodEnd')} error={errors.period_end}>
                                    <Input
                                        id="period_end"
                                        type="date"
                                        value={form.data.period_end}
                                        onChange={(e) => form.setData('period_end', e.target.value)}
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
                                    >
                                        {instrumentVersions.map((version) => (
                                            <option key={version.id} value={version.id}>
                                                {version.code}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={form.processing}>
                                    {form.processing ? t('common.saving') : t('create.submit')}
                                </Button>
                            </div>
                        </Panel>
                    </form>
                )}
            </Container>
        </>
    );
}
