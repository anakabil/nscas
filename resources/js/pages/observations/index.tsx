import { Link, useForm } from '@inertiajs/react';
import { Camera, ChevronDown, MapPin, Plus, Video } from 'lucide-react';
import { useState } from 'react';
import ObservationController from '@/actions/App/Http/Controllers/Observations/ObservationController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, NativeSelect, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Capture = {
    id: string;
    code: string;
    mimeType: string;
    capturedAt: string;
    accuracyMeters: number | null;
    distanceMeters: number | null;
    outsideRadius: boolean;
    hasLocation: boolean;
    note: string | null;
    uploadedBy: string | null;
};
type Window = {
    id: string;
    title: string;
    unitId: string;
    unitName: string;
    opensAt: string;
    closesAt: string;
    state: 'UPCOMING' | 'OPEN' | 'CLOSED';
    open: boolean;
    checklist: { code: string; label: string }[];
    latitude: number;
    longitude: number;
    radiusMeters: number;
    captures: Capture[];
};
type UnitOption = {
    id: string;
    name: string;
    depth: number;
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number | null;
};
type Props = CollectionCommon & {
    canCreate: boolean;
    canCapture: boolean;
    statusAllows: boolean;
    scoped: boolean;
    units: UnitOption[];
    windows: Window[];
};

/** Observasi lapangan (docs/01 M6): masa observasi per proyek dan galeri rekaman kamera. */
export default function ObservationsIndex(props: Props) {
    const t = useT();
    const [creating, setCreating] = useState(false);
    const notice = !props.statusAllows ? t('observations.closedStatus') : null;

    return (
        <CollectionShell
            module="observations"
            common={props}
            canEdit={props.canCreate || props.canCapture}
            showWindow={false}
            notice={notice}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    {props.canCapture ? t('observations.hintCapture') : t('observations.hintReview')}
                </p>
                {props.canCreate ? (
                    <Button onClick={() => setCreating(true)} data-testid="observation-create-open">
                        <Plus aria-hidden />
                        {t('observations.create.open')}
                    </Button>
                ) : null}
            </div>
            {props.scoped ? <p className="text-sm text-charcoal">{t('observations.scoped')}</p> : null}

            {props.windows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('observations.windows.empty')}
                </p>
            ) : (
                <ul className="space-y-4" data-testid="observation-windows">
                    {props.windows.map((w) => (
                        <WindowCard key={w.id} window={w} assessmentId={props.assessment.id} canCapture={props.canCapture} />
                    ))}
                </ul>
            )}

            {creating ? <CreateDialog {...props} onClose={() => setCreating(false)} /> : null}
        </CollectionShell>
    );
}

function WindowCard({ window: w, assessmentId, canCapture }: { window: Window; assessmentId: string; canCapture: boolean }) {
    const t = useT();
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const outside = w.captures.filter((c) => c.outsideRadius).length;
    const counts = new Map<string, number>();
    for (const c of w.captures) {
        counts.set(c.code, (counts.get(c.code) ?? 0) + 1);
    }
    const file = (id: string) => ObservationController.file.url({ assessment: assessmentId, capture: id });

    return (
        <li className="frame-hairline space-y-4 rounded-lg p-4 sm:p-5" data-testid="observation-window" data-state={w.state}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium break-words text-ink">{w.title}</span>
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                w.state === 'OPEN'
                                    ? 'bg-success/10 text-success'
                                    : w.state === 'UPCOMING'
                                      ? 'bg-gold/15 text-gold-deep'
                                      : 'bg-muted text-charcoal',
                            )}
                        >
                            {t(`observations.windows.status.${w.state}`)}
                        </span>
                    </p>
                    <p className="text-sm text-charcoal">{w.unitName}</p>
                    <p className="text-xs text-muted-foreground">
                        {t('observations.windows.period', {
                            opens: formatWib(w.opensAt, locale),
                            closes: formatWib(w.closesAt, locale),
                        })}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin aria-hidden className="size-3.5" />
                        {t('observations.windows.radius', { radius: formatNumber(w.radiusMeters, locale) })}
                    </p>
                </div>
                {canCapture && w.open ? (
                    <Button asChild className="shrink-0">
                        <Link
                            href={ObservationController.capture.url({ assessment: assessmentId, window: w.id })}
                            data-testid="observation-capture-open"
                        >
                            <Camera aria-hidden />
                            {t('observations.windows.capture')}
                        </Link>
                    </Button>
                ) : null}
            </div>

            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {w.checklist.map((c) => (
                    <li key={c.code} className="flex items-start justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
                        <span className="min-w-0 break-words text-charcoal">
                            <span className="font-medium text-ink">{c.code}</span> {c.label}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {t('observations.windows.count', { count: counts.get(c.code) ?? 0 })}
                        </span>
                    </li>
                ))}
            </ul>

            {w.captures.length > 0 ? (
                <div className="space-y-3">
                    <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-medium text-maroon"
                        aria-expanded={open}
                        onClick={() => setOpen(!open)}
                        data-testid="observation-gallery-toggle"
                    >
                        <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
                        <span>
                            {t('observations.windows.captures', { count: w.captures.length })}
                            {outside > 0 ? (
                                <span className="text-gold-deep">
                                    {t('observations.windows.outsideCount', { count: outside })}
                                </span>
                            ) : null}
                        </span>
                    </button>
                    {open ? (
                        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="observation-gallery">
                            {w.captures.map((c) => (
                                <li key={c.id} className="overflow-hidden rounded-md border border-border bg-card">
                                    <a href={file(c.id)} target="_blank" rel="noopener" className="block aspect-[4/3] bg-muted">
                                        {c.mimeType.startsWith('image/') ? (
                                            <img
                                                src={file(c.id)}
                                                alt={`${c.code} ${formatWib(c.capturedAt, locale)}`}
                                                loading="lazy"
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-charcoal">
                                                <Video aria-hidden className="size-6" />
                                                {t('observations.windows.video')}
                                            </span>
                                        )}
                                    </a>
                                    <div className="space-y-0.5 p-2 text-xs">
                                        <p className="font-medium text-ink">
                                            {c.code} · {formatWib(c.capturedAt, locale)}
                                        </p>
                                        <p className={c.outsideRadius ? 'font-semibold text-gold-deep' : 'text-muted-foreground'}>
                                            {!c.hasLocation
                                                ? t('observations.windows.noLocation')
                                                : c.outsideRadius
                                                  ? t('observations.windows.outside', {
                                                        meters: formatNumber(c.distanceMeters ?? 0, locale),
                                                    })
                                                  : t('observations.windows.inside', {
                                                        meters: formatNumber(c.distanceMeters ?? 0, locale),
                                                        accuracy: formatNumber(c.accuracyMeters ?? 0, locale),
                                                    })}
                                        </p>
                                        {c.uploadedBy ? <p className="text-muted-foreground">{c.uploadedBy}</p> : null}
                                        {c.note ? <p className="break-words text-charcoal">{c.note}</p> : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">{t('observations.windows.noCaptures')}</p>
            )}
        </li>
    );
}

function CreateDialog({ units, onClose, ...props }: Props & { onClose: () => void }) {
    const t = useT();
    const first = units.find((u) => u.latitude !== null) ?? units[0];
    const form = useForm({
        unit_id: first?.id ?? '',
        title: '',
        opens_at: '',
        closes_at: '',
        checklist: '',
        latitude: first?.latitude?.toString() ?? '',
        longitude: first?.longitude?.toString() ?? '',
        radius_meters: (first?.radiusMeters ?? 300).toString(),
    });
    const pickUnit = (id: string) => {
        const unit = units.find((u) => u.id === id);
        form.setData((d) => ({
            ...d,
            unit_id: id,
            latitude: unit?.latitude?.toString() ?? '',
            longitude: unit?.longitude?.toString() ?? '',
            radius_meters: (unit?.radiusMeters ?? 300).toString(),
        }));
    };

    return (
        <Dialog open onOpenChange={(open) => (!open && !form.processing ? onClose() : undefined)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="observation-create-dialog">
                <DialogHeader>
                    <DialogTitle>{t('observations.create.title')}</DialogTitle>
                    <DialogDescription>{t('observations.create.hint')}</DialogDescription>
                </DialogHeader>
                <form
                    className="grid gap-4 sm:grid-cols-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(ObservationController.storeWindow.url({ assessment: props.assessment.id }), {
                            preserveScroll: true,
                            onSuccess: () => onClose(),
                        });
                    }}
                >
                    <Field
                        id="ow-unit"
                        label={t('observations.create.unit')}
                        error={form.errors.unit_id}
                        className="sm:col-span-2"
                    >
                        <NativeSelect id="ow-unit" value={form.data.unit_id} onChange={(e) => pickUnit(e.target.value)} required>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {' '.repeat(u.depth * 3)}
                                    {u.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field
                        id="ow-title"
                        label={t('observations.create.name')}
                        error={form.errors.title}
                        className="sm:col-span-2"
                    >
                        <Input
                            id="ow-title"
                            value={form.data.title}
                            onChange={(e) => form.setData('title', e.target.value)}
                            required
                            minLength={2}
                            maxLength={200}
                            placeholder={t('observations.create.namePlaceholder')}
                        />
                    </Field>
                    <Field id="ow-opens" label={t('observations.create.opensAt')} error={form.errors.opens_at}>
                        <Input
                            id="ow-opens"
                            type="datetime-local"
                            value={form.data.opens_at}
                            onChange={(e) => form.setData('opens_at', e.target.value)}
                            required
                        />
                    </Field>
                    <Field id="ow-closes" label={t('observations.create.closesAt')} error={form.errors.closes_at}>
                        <Input
                            id="ow-closes"
                            type="datetime-local"
                            value={form.data.closes_at}
                            onChange={(e) => form.setData('closes_at', e.target.value)}
                            required
                        />
                    </Field>
                    <Field
                        id="ow-checklist"
                        label={t('observations.create.checklist')}
                        hint={t('observations.create.checklistHint')}
                        error={form.errors.checklist}
                        className="sm:col-span-2"
                    >
                        <TextArea
                            id="ow-checklist"
                            value={form.data.checklist}
                            onChange={(e) => form.setData('checklist', e.target.value)}
                            rows={4}
                            required
                        />
                    </Field>
                    <Field id="ow-lat" label={t('observations.create.latitude')} error={form.errors.latitude}>
                        <Input
                            id="ow-lat"
                            inputMode="decimal"
                            value={form.data.latitude}
                            onChange={(e) => form.setData('latitude', e.target.value)}
                            required
                        />
                    </Field>
                    <Field id="ow-lng" label={t('observations.create.longitude')} error={form.errors.longitude}>
                        <Input
                            id="ow-lng"
                            inputMode="decimal"
                            value={form.data.longitude}
                            onChange={(e) => form.setData('longitude', e.target.value)}
                            required
                        />
                    </Field>
                    <Field
                        id="ow-radius"
                        label={t('observations.create.radius')}
                        error={form.errors.radius_meters}
                        hint={t('observations.create.coordinatesHint')}
                    >
                        <Input
                            id="ow-radius"
                            type="number"
                            min={10}
                            max={50000}
                            value={form.data.radius_meters}
                            onChange={(e) => form.setData('radius_meters', e.target.value)}
                            required
                        />
                    </Field>
                    <div className="sm:col-span-2">
                        <FormError message={(form.errors as Record<string, string | undefined>).form} />
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={onClose} disabled={form.processing}>
                            {t('observations.create.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing} data-testid="observation-create-submit">
                            {t('observations.create.submit')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
