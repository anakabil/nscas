import { router, useForm } from '@inertiajs/react';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import UnitController from '@/actions/App/Http/Controllers/Setup/UnitController';
import { Field, FormError, NativeSelect, Panel, SetupShell, formatNumber } from '@/components/nscas/setup-shell';
import type { SetupCommon } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

type UnitRow = {
    id: string;
    parentId: string | null;
    name: string;
    type: string;
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number | null;
    depth: number;
};

type Props = SetupCommon & { units: UnitRow[] };

const TYPES = ['HEAD_OFFICE', 'DIVISION', 'PROJECT', 'BRANCH'] as const;

const EMPTY = { name: '', type: 'PROJECT', parent_id: '', latitude: '', longitude: '', radius_meters: '' };

/** Halaman unit bertingkat (tahap 1). Unit tetap dapat ditambah setelah parameter dikunci, sampai asesmen ditutup. */
export default function SetupUnits(props: Props) {
    const t = useT();
    const locale = useLocale();
    const [editing, setEditing] = useState<UnitRow | null>(null);
    const form = useForm(EMPTY);
    const errors = form.errors as Record<string, string | undefined>;
    const projects = props.units.filter((u) => u.type === 'PROJECT').length;
    const decimal = (value: number | null) =>
        value === null
            ? ''
            : new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', { maximumFractionDigits: 6 }).format(value);

    const startEdit = (unit: UnitRow) => {
        setEditing(unit);
        form.clearErrors();
        form.setData({
            name: unit.name,
            type: unit.type,
            parent_id: unit.parentId ?? '',
            latitude: unit.latitude === null ? '' : String(unit.latitude).replace('.', locale === 'id' ? ',' : '.'),
            longitude: unit.longitude === null ? '' : String(unit.longitude).replace('.', locale === 'id' ? ',' : '.'),
            radius_meters: unit.radiusMeters === null ? '' : String(unit.radiusMeters),
        });
    };
    const reset = () => {
        setEditing(null);
        form.setData(EMPTY);
        form.clearErrors();
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            parent_id: data.parent_id || null,
            latitude: data.type === 'PROJECT' && data.latitude !== '' ? data.latitude : null,
            longitude: data.type === 'PROJECT' && data.longitude !== '' ? data.longitude : null,
            radius_meters: data.type === 'PROJECT' && data.radius_meters !== '' ? Number(data.radius_meters) : null,
        }));
        const options = { preserveScroll: true, onSuccess: reset };
        if (editing) {
            form.put(UnitController.update.url({ assessment: props.assessment.id, unit: editing.id }), options);
        } else {
            form.post(UnitController.store.url(props.assessment.id), options);
        }
    };
    const remove = (unit: UnitRow) => {
        if (window.confirm(t('common.confirmDelete', { name: unit.name }))) {
            router.delete(UnitController.destroy.url({ assessment: props.assessment.id, unit: unit.id }), {
                preserveScroll: true,
            });
        }
    };
    // Unit yang sedang diubah dan keturunannya tidak boleh menjadi induk.
    const descendants = new Set<string>();
    if (editing) {
        descendants.add(editing.id);
        let grew = true;
        while (grew) {
            grew = false;
            for (const unit of props.units) {
                if (unit.parentId && descendants.has(unit.parentId) && !descendants.has(unit.id)) {
                    descendants.add(unit.id);
                    grew = true;
                }
            }
        }
    }

    return (
        <SetupShell module="units" common={props}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('units.intro')}</p>
            <Panel title={t('units.summary', { count: props.units.length, projects })}>
                <FormError message={errors.unit} />
                {props.units.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('units.empty')}</p>
                ) : (
                    <ul className="divide-y divide-border" data-testid="unit-tree">
                        {props.units.map((unit) => (
                            <li key={unit.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                                <div className="min-w-0 flex-1" style={{ paddingLeft: `${unit.depth * 1.25}rem` }}>
                                    <p className="truncate text-sm font-medium text-ink">
                                        {unit.depth > 0 ? (
                                            <span aria-hidden className="mr-2 text-taupe-dim">
                                                └
                                            </span>
                                        ) : null}
                                        {unit.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t(`units.types.${unit.type}`)}
                                        {unit.type === 'PROJECT' ? (
                                            <span className="ml-2 inline-flex items-center gap-1">
                                                <MapPin aria-hidden className="size-3" />
                                                {unit.latitude !== null
                                                    ? `${decimal(unit.latitude)}; ${decimal(unit.longitude)} · ${formatNumber(unit.radiusMeters ?? 0, locale)} m`
                                                    : t('units.coordinatesMissing')}
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                {props.canEdit ? (
                                    <div className="flex gap-1">
                                        <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(unit)}>
                                            <Pencil aria-hidden />
                                            {t('common.edit')}
                                        </Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => remove(unit)}>
                                            <Trash2 aria-hidden />
                                            {t('common.delete')}
                                        </Button>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            {props.canEdit ? (
                <form onSubmit={submit}>
                    <Panel
                        title={editing ? t('units.editTitle') : t('units.addTitle')}
                        hint={props.locked ? t('units.afterLock') : undefined}
                    >
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field id="unit-name" label={t('units.name')} error={errors.name}>
                                <Input
                                    id="unit-name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    required
                                />
                            </Field>
                            <Field id="unit-type" label={t('units.type')} error={errors.type}>
                                <NativeSelect
                                    id="unit-type"
                                    value={form.data.type}
                                    onChange={(e) => form.setData('type', e.target.value)}
                                >
                                    {TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {t(`units.types.${type}`)}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field id="unit-parent" label={t('units.parent')} error={errors.parent_id} className="sm:col-span-2">
                                <NativeSelect
                                    id="unit-parent"
                                    value={form.data.parent_id}
                                    onChange={(e) => form.setData('parent_id', e.target.value)}
                                >
                                    <option value="">{t('units.noParent')}</option>
                                    {props.units
                                        .filter((unit) => !descendants.has(unit.id))
                                        .map((unit) => (
                                            <option key={unit.id} value={unit.id}>
                                                {`${'  '.repeat(unit.depth)}${unit.name}`}
                                            </option>
                                        ))}
                                </NativeSelect>
                            </Field>
                            {form.data.type === 'PROJECT' ? (
                                <>
                                    <Field id="unit-lat" label={t('units.latitude')} error={errors.latitude}>
                                        <Input
                                            id="unit-lat"
                                            inputMode="decimal"
                                            value={form.data.latitude}
                                            onChange={(e) => form.setData('latitude', e.target.value)}
                                        />
                                    </Field>
                                    <Field id="unit-lng" label={t('units.longitude')} error={errors.longitude}>
                                        <Input
                                            id="unit-lng"
                                            inputMode="decimal"
                                            value={form.data.longitude}
                                            onChange={(e) => form.setData('longitude', e.target.value)}
                                        />
                                    </Field>
                                    <Field
                                        id="unit-radius"
                                        label={t('units.radius')}
                                        error={errors.radius_meters}
                                        hint={t('units.coordinatesHint')}
                                        className="sm:col-span-2"
                                    >
                                        <Input
                                            id="unit-radius"
                                            inputMode="numeric"
                                            value={form.data.radius_meters}
                                            onChange={(e) => form.setData('radius_meters', e.target.value.replace(/\D/g, ''))}
                                            className="sm:max-w-48"
                                        />
                                    </Field>
                                </>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            {editing ? (
                                <Button type="button" variant="outline" onClick={reset}>
                                    {t('common.cancel')}
                                </Button>
                            ) : null}
                            <Button type="submit" disabled={form.processing}>
                                {form.processing ? t('common.saving') : editing ? t('common.save') : t('units.add')}
                            </Button>
                        </div>
                    </Panel>
                </form>
            ) : null}
        </SetupShell>
    );
}
