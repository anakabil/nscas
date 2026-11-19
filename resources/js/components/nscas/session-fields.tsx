import type { InertiaFormProps } from '@inertiajs/react';
import { Field, NativeSelect } from '@/components/nscas/setup-shell';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

/** Rujukan untuk isian sesi validasi yang dikirim ValidationController::references(). */
export type Reference = {
    characteristics: { id: string; code: string; name: string; nameEn: string | null }[];
    units: { id: string; name: string }[];
    strata: { id: string; code: string; name: string }[];
};

export type SessionData = {
    type: string;
    label: string;
    layer: string;
    unitId: string;
    stratumId: string;
    scheduledAt: string;
    meetingUrl: string;
    location: string;
    participantCount: string;
    focus: string[];
    status: SessionStatus;
};

export const SESSION_TYPES = ['INTERVIEW', 'FOCUS_GROUP', 'SITE_VISIT', 'VIRTUAL_SITE_VISIT'] as const;
export const LAYERS = ['MANAGEMENT', 'SUPERVISORY', 'FIELD'] as const;
const STATUSES: SessionStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

/** Waktu ISO ke nilai isian datetime-local dalam WIB. */
export function toWibInput(value: string | null): string {
    if (!value) {
        return '';
    }
    return new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function emptySession(): SessionData {
    return {
        type: 'INTERVIEW',
        label: '',
        layer: 'FIELD',
        unitId: '',
        stratumId: '',
        scheduledAt: '',
        meetingUrl: '',
        location: '',
        participantCount: '',
        focus: [],
        status: 'SCHEDULED',
    };
}

/** Data isian dikirim dengan nilai kosong sebagai null agar validasi server tidak menolak string kosong. */
export function sessionPayload(data: SessionData): Record<string, unknown> {
    const blank = (v: string) => (v.trim() === '' ? null : v.trim());
    return {
        ...data,
        unitId: blank(data.unitId),
        stratumId: blank(data.stratumId),
        scheduledAt: blank(data.scheduledAt),
        meetingUrl: blank(data.meetingUrl),
        location: blank(data.location),
        participantCount: data.participantCount === '' ? null : Number(data.participantCount),
    };
}

/** Isian jadwal, sasaran, dan karakteristik fokus satu sesi validasi. */
export function SessionFields({
    form,
    reference,
    withType = false,
    withStatus = false,
}: {
    form: InertiaFormProps<SessionData>;
    reference: Reference;
    withType?: boolean;
    withStatus?: boolean;
}) {
    const t = useT();
    const locale = useLocale();
    const errors = form.errors as Record<string, string | undefined>;
    const visit = form.data.type === 'SITE_VISIT' || form.data.type === 'VIRTUAL_SITE_VISIT';
    const toggleFocus = (id: string, on: boolean) =>
        form.setData('focus', on ? [...form.data.focus, id] : form.data.focus.filter((x) => x !== id));
    return (
        <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
                {withType ? (
                    <Field id="session-type" label={t('validation.form.type')} error={errors.type}>
                        <NativeSelect
                            id="session-type"
                            value={form.data.type}
                            onChange={(e) => form.setData('type', e.target.value)}
                        >
                            {SESSION_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {t(`validation.types.${type}`)}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                ) : null}
                {withStatus ? (
                    <Field id="session-status" label={t('validation.form.status')} error={errors.status}>
                        <NativeSelect
                            id="session-status"
                            value={form.data.status}
                            onChange={(e) => form.setData('status', e.target.value as SessionStatus)}
                        >
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {t(`validation.statuses.${status}`)}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                ) : null}
                <Field id="session-label" label={t('validation.form.label')} error={errors.label}>
                    <Input
                        id="session-label"
                        required
                        minLength={2}
                        maxLength={200}
                        value={form.data.label}
                        onChange={(e) => form.setData('label', e.target.value)}
                    />
                </Field>
                <Field id="session-layer" label={t('validation.form.layer')} error={errors.layer}>
                    <NativeSelect
                        id="session-layer"
                        value={form.data.layer}
                        onChange={(e) => form.setData('layer', e.target.value)}
                    >
                        {LAYERS.map((layer) => (
                            <option key={layer} value={layer}>
                                {t(`groupsShort.${layer}`)}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>
                <Field id="session-scheduled" label={t('validation.form.scheduledAt')} error={errors.scheduledAt}>
                    <Input
                        id="session-scheduled"
                        type="datetime-local"
                        value={form.data.scheduledAt}
                        onChange={(e) => form.setData('scheduledAt', e.target.value)}
                    />
                </Field>
                <Field id="session-unit" label={t('validation.form.unit')} error={errors.unitId}>
                    <NativeSelect
                        id="session-unit"
                        value={form.data.unitId}
                        onChange={(e) => form.setData('unitId', e.target.value)}
                    >
                        <option value="">{t('validation.form.none')}</option>
                        {reference.units.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>
                {!visit ? (
                    <Field id="session-stratum" label={t('validation.form.stratum')} error={errors.stratumId}>
                        <NativeSelect
                            id="session-stratum"
                            value={form.data.stratumId}
                            onChange={(e) => form.setData('stratumId', e.target.value)}
                        >
                            <option value="">{t('validation.form.none')}</option>
                            {reference.strata.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.code} {s.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                ) : null}
                {form.data.type !== 'SITE_VISIT' ? (
                    <Field
                        id="session-url"
                        label={t('validation.form.meetingUrl')}
                        hint={t('validation.form.meetingUrlHint')}
                        error={errors.meetingUrl}
                    >
                        <Input
                            id="session-url"
                            type="url"
                            inputMode="url"
                            pattern="https://.*"
                            maxLength={500}
                            value={form.data.meetingUrl}
                            onChange={(e) => form.setData('meetingUrl', e.target.value)}
                        />
                    </Field>
                ) : null}
                {form.data.type !== 'VIRTUAL_SITE_VISIT' ? (
                    <Field id="session-location" label={t('validation.form.location')} error={errors.location}>
                        <Input
                            id="session-location"
                            maxLength={300}
                            value={form.data.location}
                            onChange={(e) => form.setData('location', e.target.value)}
                        />
                    </Field>
                ) : null}
                {!visit ? (
                    <Field id="session-count" label={t('validation.form.participantCount')} error={errors.participantCount}>
                        <Input
                            id="session-count"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={form.data.type === 'FOCUS_GROUP' ? 8 : 500}
                            value={form.data.participantCount}
                            onChange={(e) => form.setData('participantCount', e.target.value)}
                        />
                    </Field>
                ) : null}
            </div>
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{t('validation.form.focus')}</legend>
                <p className="text-xs text-muted-foreground">{t('validation.form.focusHint')}</p>
                <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                    {reference.characteristics.map((c) => (
                        <label key={c.id} className="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60">
                            <input
                                type="checkbox"
                                className="mt-0.5 size-4 shrink-0 accent-maroon"
                                checked={form.data.focus.includes(c.id)}
                                onChange={(e) => toggleFocus(c.id, e.target.checked)}
                            />
                            <span className="min-w-0">
                                <span className="font-medium text-ink">{c.code}</span>{' '}
                                {locale === 'en' && c.nameEn ? c.nameEn : c.name}
                            </span>
                        </label>
                    ))}
                </div>
                {errors.focus ? <p className="text-sm text-destructive">{errors.focus}</p> : null}
            </fieldset>
        </div>
    );
}
