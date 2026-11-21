import { router, useForm } from '@inertiajs/react';
import { BookmarkPlus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import StratumController from '@/actions/App/Http/Controllers/Setup/StratumController';
import { Field, FormError, NativeSelect, Panel, SetupShell, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import type { SetupCommon } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

type StratumRow = {
    id: string;
    code: string;
    name: string;
    group: string;
    population: number;
    isContractor: boolean;
    jobTitles: string[];
};

type Props = SetupCommon & { strata: StratumRow[]; canSaveTemplate: boolean; templateCount: number };

const GROUPS = ['MANAGEMENT', 'SUPERVISORY', 'FIELD'] as const;

const EMPTY = { code: '', name: '', group: 'FIELD', population: '0', is_contractor: false, job_titles: '' };

/** Halaman strata jabatan dan jumlah pekerjanya (tahap 1). Tidak dapat diubah setelah parameter dikunci. */
export default function SetupStrata(props: Props) {
    const t = useT();
    const locale = useLocale();
    const [editing, setEditing] = useState<StratumRow | null>(null);
    const populations = useForm<{ populations: Record<string, string> }>({
        populations: Object.fromEntries(props.strata.map((s) => [s.id, String(s.population)])),
    });
    const form = useForm(EMPTY);
    const errors = {
        ...(populations.errors as Record<string, string | undefined>),
        ...(form.errors as Record<string, string | undefined>),
    };
    // Strata baru belum ada di status formulir; nilainya diambil dari data halaman.
    const valueOf = (stratum: StratumRow) => populations.data.populations[stratum.id] ?? String(stratum.population);
    const total = props.strata.reduce((sum, stratum) => sum + (Number(valueOf(stratum)) || 0), 0);

    const startEdit = (stratum: StratumRow) => {
        setEditing(stratum);
        form.clearErrors();
        form.setData({
            code: stratum.code,
            name: stratum.name,
            group: stratum.group,
            population: String(stratum.population),
            is_contractor: stratum.isContractor,
            job_titles: stratum.jobTitles.join('\n'),
        });
    };
    const reset = () => {
        setEditing(null);
        form.setData(EMPTY);
        form.clearErrors();
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, population: Number(data.population) || 0 }));
        const options = { preserveScroll: true, onSuccess: reset };
        if (editing) {
            form.put(StratumController.update.url({ assessment: props.assessment.id, stratum: editing.id }), options);
        } else {
            form.post(StratumController.store.url(props.assessment.id), options);
        }
    };
    const saveTemplate = () => {
        const message = props.templateCount > 0 ? t('strata.template.confirmReplace') : t('strata.template.confirm');
        if (window.confirm(message)) {
            router.post(StratumController.saveTemplate.url(props.assessment.id), {}, { preserveScroll: true });
        }
    };
    const remove = (stratum: StratumRow) => {
        if (window.confirm(t('common.confirmDelete', { name: `${stratum.code} ${stratum.name}` }))) {
            router.delete(StratumController.destroy.url({ assessment: props.assessment.id, stratum: stratum.id }), {
                preserveScroll: true,
            });
        }
    };

    return (
        <SetupShell module="strata" common={props}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('strata.intro')}</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    populations.transform(() => ({
                        populations: Object.fromEntries(
                            props.strata.map((stratum) => [stratum.id, Number(valueOf(stratum)) || 0]),
                        ),
                    }));
                    populations.put(StratumController.populations.url(props.assessment.id), { preserveScroll: true });
                }}
            >
                <Panel>
                    <FormError message={errors.form ?? errors.stratum} />
                    {props.strata.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('strata.empty')}</p>
                    ) : (
                        <div className="relative -mx-2 overflow-x-auto">
                            <table className="w-full min-w-[36rem] text-sm" data-testid="strata-table">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                        <th className="px-2 py-2 font-medium">{t('strata.code')}</th>
                                        <th className="px-2 py-2 font-medium">{t('strata.name')}</th>
                                        <th className="px-2 py-2 font-medium">{t('strata.group')}</th>
                                        <th className="px-2 py-2 text-right font-medium">{t('strata.population')}</th>
                                        {props.canEdit ? <th className="px-2 py-2" /> : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.strata.map((stratum) => {
                                        const value = valueOf(stratum);
                                        return (
                                            <tr key={stratum.id} className="border-b border-border/70 align-middle">
                                                <td className="numeral px-2 py-2.5 font-semibold text-ink">{stratum.code}</td>
                                                <td className="px-2 py-2.5">
                                                    <span className="text-foreground">{stratum.name}</span>
                                                    {stratum.isContractor ? (
                                                        <span className="ml-2 rounded-sm bg-parchment px-1.5 py-0.5 text-[0.7rem] text-charcoal">
                                                            {t('strata.contractor')}
                                                        </span>
                                                    ) : null}
                                                    {stratum.jobTitles.length > 0 ? (
                                                        <p
                                                            className="mt-1 text-xs leading-relaxed text-muted-foreground"
                                                            data-testid="stratum-job-titles"
                                                        >
                                                            {t('strata.jobTitles.listed', {
                                                                titles: stratum.jobTitles.join(', '),
                                                            })}
                                                        </p>
                                                    ) : props.canEdit ? (
                                                        <p className="mt-1 text-xs text-gold-deep">
                                                            {t('strata.jobTitles.none')}
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td className="px-2 py-2.5 text-muted-foreground">
                                                    {t(`strata.groups.${stratum.group}`)}
                                                </td>
                                                <td className="px-2 py-2.5 text-right">
                                                    {props.canEdit ? (
                                                        <Input
                                                            aria-label={`${t('strata.population')} ${stratum.code}`}
                                                            inputMode="numeric"
                                                            value={value}
                                                            onChange={(e) =>
                                                                populations.setData('populations', {
                                                                    ...populations.data.populations,
                                                                    [stratum.id]: e.target.value.replace(/\D/g, ''),
                                                                })
                                                            }
                                                            className="numeral ml-auto w-28 text-right"
                                                        />
                                                    ) : (
                                                        <span className="numeral">
                                                            {formatNumber(stratum.population, locale)}
                                                        </span>
                                                    )}
                                                    {Number(value) <= 0 ? (
                                                        <p className="mt-1 text-xs text-gold-deep">
                                                            {t('strata.populationMissing')}
                                                        </p>
                                                    ) : null}
                                                </td>
                                                {props.canEdit ? (
                                                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => startEdit(stratum)}
                                                        >
                                                            <Pencil aria-hidden />
                                                            <span className="sr-only sm:not-sr-only">{t('common.edit')}</span>
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => remove(stratum)}
                                                        >
                                                            <Trash2 aria-hidden />
                                                            <span className="sr-only sm:not-sr-only">{t('common.delete')}</span>
                                                        </Button>
                                                    </td>
                                                ) : null}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} className="px-2 pt-3 font-semibold text-ink">
                                            {t('strata.total')}
                                        </td>
                                        <td className="numeral px-2 pt-3 text-right font-semibold text-ink">
                                            {formatNumber(total, locale)}
                                        </td>
                                        {props.canEdit ? <td /> : null}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {props.canEdit && props.strata.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">{t('strata.sampleNote')}</p>
                            <Button type="submit" disabled={populations.processing}>
                                {populations.processing ? t('common.saving') : t('strata.savePopulations')}
                            </Button>
                        </div>
                    ) : null}
                </Panel>
            </form>

            {props.canSaveTemplate ? (
                <Panel title={t('strata.template.title')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            {props.templateCount > 0
                                ? t('strata.template.saved', { count: formatNumber(props.templateCount, locale) })
                                : t('strata.template.none')}
                        </p>
                        <Button type="button" variant="outline" onClick={saveTemplate} data-testid="strata-template">
                            <BookmarkPlus aria-hidden />
                            {t('strata.template.save')}
                        </Button>
                    </div>
                </Panel>
            ) : null}

            {props.canEdit ? (
                <form onSubmit={submit}>
                    <Panel title={editing ? t('strata.editTitle') : t('strata.addTitle')}>
                        <div className="grid gap-5 sm:grid-cols-[8rem_minmax(0,1fr)]">
                            <Field id="stratum-code" label={t('strata.code')} error={errors.code}>
                                <Input
                                    id="stratum-code"
                                    value={form.data.code}
                                    onChange={(e) => form.setData('code', e.target.value.toUpperCase())}
                                    maxLength={20}
                                    required
                                />
                            </Field>
                            <Field id="stratum-name" label={t('strata.name')} error={errors.name}>
                                <Input
                                    id="stratum-name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    required
                                />
                            </Field>
                            <Field id="stratum-group" label={t('strata.group')} error={errors.group}>
                                <NativeSelect
                                    id="stratum-group"
                                    value={form.data.group}
                                    onChange={(e) => form.setData('group', e.target.value)}
                                >
                                    {GROUPS.map((group) => (
                                        <option key={group} value={group}>
                                            {t(`strata.groups.${group}`)}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field id="stratum-population" label={t('strata.population')} error={errors.population}>
                                <Input
                                    id="stratum-population"
                                    inputMode="numeric"
                                    value={form.data.population}
                                    onChange={(e) => form.setData('population', e.target.value.replace(/\D/g, ''))}
                                    className="sm:max-w-40"
                                />
                            </Field>
                            <div className="sm:col-span-2">
                                <Field
                                    id="stratum-job-titles"
                                    label={t('strata.jobTitles.label')}
                                    hint={t('strata.jobTitles.hint')}
                                    error={errors.job_titles}
                                >
                                    <TextArea
                                        id="stratum-job-titles"
                                        value={form.data.job_titles}
                                        onChange={(e) => form.setData('job_titles', e.target.value)}
                                        placeholder={t('strata.jobTitles.placeholder')}
                                        rows={4}
                                        maxLength={5000}
                                    />
                                </Field>
                            </div>
                            <div className="flex items-center gap-3 sm:col-span-2">
                                <Checkbox
                                    id="stratum-contractor"
                                    checked={form.data.is_contractor}
                                    onCheckedChange={(checked) => form.setData('is_contractor', checked === true)}
                                />
                                <label htmlFor="stratum-contractor" className="text-sm text-foreground">
                                    {t('strata.contractorHint')}
                                </label>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            {editing ? (
                                <Button type="button" variant="outline" onClick={reset}>
                                    {t('common.cancel')}
                                </Button>
                            ) : null}
                            <Button type="submit" disabled={form.processing}>
                                {form.processing ? t('common.saving') : editing ? t('common.save') : t('strata.add')}
                            </Button>
                        </div>
                    </Panel>
                </form>
            ) : null}
        </SetupShell>
    );
}
