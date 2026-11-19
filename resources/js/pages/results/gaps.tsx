import { router, useForm, usePage } from '@inertiajs/react';
import { CheckCircle2, ChevronDown, Pencil, Plus, Send } from 'lucide-react';
import { useState } from 'react';
import GapsController from '@/actions/App/Http/Controllers/Results/GapsController';
import { DUE_STYLE, formatDay } from '@/components/nscas/action-format';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, NativeSelect, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Action = {
    id: string;
    title: string;
    description: string | null;
    ownerName: string;
    ownerPosition: string;
    hasEmail: boolean;
    unitId: string | null;
    unit: string | null;
    dueDate: string;
    successIndicator: string;
    status: string;
    progress: number;
    dueState: string;
    editable: boolean;
};
type Gap = {
    id: string;
    code: string;
    name: string;
    nameEn: string | null;
    currentIndex: number;
    targetLevel: number;
    gap: number;
    rank: number;
    contextual: boolean;
    rootCause: string | null;
    priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    actions: Action[];
};
type Props = CollectionCommon & {
    canAnalyse: boolean;
    canAct: boolean;
    canPublish: boolean;
    open: boolean;
    scoped: boolean;
    units: { id: string; name: string }[];
    plan: { publishedAt: string | null; incomplete: string[]; gaps: Gap[] };
};

/** Daftar kesenjangan dan rencana aksi (docs/01 M10). */
export default function Gaps(props: Props) {
    const t = useT();
    const locale = useLocale();
    const errors = usePage<{ errors: Record<string, string | undefined> }>().props.errors;
    const [open, setOpen] = useState<string | null>(props.plan.gaps[0]?.id ?? null);
    const [editing, setEditing] = useState<{ gap: Gap; action: Action | null } | null>(null);
    const p = props.plan;

    return (
        <CollectionShell
            module="gaps"
            common={props}
            canEdit={props.canAct}
            showWindow={false}
            notice={props.open ? null : t('gaps.closed')}
        >
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('gaps.intro')}</p>
            {props.scoped ? <p className="text-sm text-charcoal">{t('gaps.scoped')}</p> : null}
            <FormError message={errors.form} />
            {p.gaps.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="gaps-empty">
                    {props.open ? t('gaps.empty') : t('gaps.notReady')}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3" data-testid="gaps-publication">
                        {p.publishedAt ? (
                            <p className="text-sm text-success">
                                {t('gaps.published', { date: formatWib(p.publishedAt, locale) })}
                            </p>
                        ) : p.incomplete.length > 0 ? (
                            <p className="text-sm text-gold-deep">
                                {t('gaps.incomplete', { count: p.incomplete.length, codes: p.incomplete.join(', ') })}
                            </p>
                        ) : null}
                        {props.canPublish && !p.publishedAt ? (
                            <Button
                                size="sm"
                                disabled={p.incomplete.length > 0}
                                data-testid="gaps-publish"
                                onClick={() => {
                                    if (window.confirm(t('gaps.confirmPublish'))) {
                                        router.post(
                                            GapsController.publish.url(props.assessment.id),
                                            {},
                                            { preserveScroll: true },
                                        );
                                    }
                                }}
                            >
                                <Send aria-hidden />
                                {t('gaps.publish')}
                            </Button>
                        ) : null}
                    </div>
                    <ul className="divide-y divide-border rounded-lg border border-border" data-testid="gap-list">
                        {p.gaps.map((g) => {
                            const expanded = open === g.id;
                            const complete = !p.incomplete.includes(g.code);
                            return (
                                <li key={g.id} data-code={g.code}>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                                        aria-expanded={expanded}
                                        onClick={() => setOpen(expanded ? null : g.id)}
                                    >
                                        <span
                                            aria-hidden
                                            className="numeral flex size-8 shrink-0 items-center justify-center rounded-full bg-maroon text-sm text-parchment"
                                        >
                                            {g.rank}
                                        </span>
                                        <span className="min-w-0 flex-1 space-y-0.5">
                                            <span className="block text-sm text-ink">
                                                <span className="font-medium">{g.code}</span>{' '}
                                                {locale === 'en' && g.nameEn ? g.nameEn : g.name}
                                                {g.contextual ? (
                                                    <span className="ml-1 text-xs text-muted-foreground">
                                                        ({t('gaps.contextual')})
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span className="numeral block text-xs text-muted-foreground">
                                                {t('gaps.figures', {
                                                    current: formatNumber(g.currentIndex, locale, 2),
                                                    target: formatNumber(g.targetLevel, locale, 0),
                                                    gap: formatNumber(g.gap, locale, 2),
                                                })}
                                                {', '}
                                                {t('gaps.actionsCount', { count: g.actions.length })}
                                            </span>
                                        </span>
                                        {g.priority ? (
                                            <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-charcoal sm:inline">
                                                {t(`gaps.priorities.${g.priority}`)}
                                            </span>
                                        ) : null}
                                        {complete ? (
                                            <CheckCircle2
                                                aria-label={t('gaps.complete')}
                                                className="size-4 shrink-0 text-success"
                                            />
                                        ) : null}
                                        <ChevronDown
                                            aria-hidden
                                            className={cn(
                                                'size-4 shrink-0 text-muted-foreground transition-transform',
                                                expanded && 'rotate-180',
                                            )}
                                        />
                                    </button>
                                    {expanded ? (
                                        <div className="space-y-5 px-4 pb-5">
                                            <Analysis gap={g} canEdit={props.canAnalyse} assessment={props.assessment.id} />
                                            <div className="space-y-3">
                                                {g.actions.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">{t('gaps.actions.empty')}</p>
                                                ) : (
                                                    <ul className="space-y-2">
                                                        {g.actions.map((a) => (
                                                            <li
                                                                key={a.id}
                                                                className="frame-hairline rounded-md px-3 py-2.5 text-sm"
                                                            >
                                                                <div className="flex flex-wrap items-start gap-2">
                                                                    <p className="min-w-0 flex-1 font-medium text-ink">
                                                                        {a.title}
                                                                    </p>
                                                                    <span
                                                                        className={cn(
                                                                            'rounded-full px-2 py-0.5 text-xs font-medium',
                                                                            DUE_STYLE[a.dueState],
                                                                        )}
                                                                    >
                                                                        {t(`actionStatuses.${a.status}`)}
                                                                    </span>
                                                                    {props.canAct && a.editable && a.status !== 'VERIFIED' ? (
                                                                        <Button
                                                                            type="button"
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="size-7"
                                                                            aria-label={t('gaps.actions.edit')}
                                                                            title={t('gaps.actions.edit')}
                                                                            onClick={() => setEditing({ gap: g, action: a })}
                                                                        >
                                                                            <Pencil aria-hidden />
                                                                        </Button>
                                                                    ) : null}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {t('gaps.actions.owner', {
                                                                        name: a.ownerName,
                                                                        position: a.ownerPosition,
                                                                    })}
                                                                    {a.unit ? `, ${a.unit}` : ''}
                                                                    {', '}
                                                                    {t('gaps.actions.due', {
                                                                        date: formatDay(a.dueDate, locale),
                                                                    })}
                                                                </p>
                                                                <p className="text-xs text-charcoal">{a.successIndicator}</p>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {props.canAct ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setEditing({ gap: g, action: null })}
                                                        data-testid="action-add"
                                                    >
                                                        <Plus aria-hidden />
                                                        {t('gaps.actions.add')}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
            {editing ? (
                <ActionDialog
                    {...editing}
                    units={props.units}
                    assessment={props.assessment.id}
                    onClose={() => setEditing(null)}
                />
            ) : null}
        </CollectionShell>
    );
}

function Analysis({ gap, canEdit, assessment }: { gap: Gap; canEdit: boolean; assessment: string }) {
    const t = useT();
    const form = useForm({ rootCause: gap.rootCause ?? '', priority: gap.priority ?? '' });
    if (!canEdit) {
        return (
            <div className="space-y-1 text-sm">
                <p className="font-medium text-ink">{t('gaps.analysis.rootCause')}</p>
                <p className="whitespace-pre-line text-charcoal">{gap.rootCause ?? t('gaps.analysis.empty')}</p>
            </div>
        );
    }
    return (
        <form
            className="space-y-3"
            onSubmit={(e) => {
                e.preventDefault();
                form.transform((data) => ({ ...data, priority: data.priority === '' ? null : data.priority }));
                form.put(GapsController.analyse.url({ assessment, gap: gap.id }), { preserveScroll: true });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <Field
                    id={`root-${gap.id}`}
                    label={t('gaps.analysis.rootCause')}
                    hint={t('gaps.analysis.rootCauseHint')}
                    error={form.errors.rootCause}
                >
                    <TextArea
                        id={`root-${gap.id}`}
                        rows={3}
                        maxLength={4000}
                        value={form.data.rootCause}
                        onChange={(e) => form.setData('rootCause', e.target.value)}
                    />
                </Field>
                <Field id={`prio-${gap.id}`} label={t('gaps.analysis.priority')} error={form.errors.priority}>
                    <NativeSelect
                        id={`prio-${gap.id}`}
                        value={form.data.priority}
                        onChange={(e) => form.setData('priority', e.target.value)}
                    >
                        <option value="">{t('gaps.analysis.none')}</option>
                        {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                            <option key={p} value={p}>
                                {t(`gaps.priorities.${p}`)}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={form.processing}>
                {t('gaps.analysis.save')}
            </Button>
        </form>
    );
}

function ActionDialog({
    gap,
    action,
    units,
    assessment,
    onClose,
}: {
    gap: Gap;
    action: Action | null;
    units: { id: string; name: string }[];
    assessment: string;
    onClose: () => void;
}) {
    const t = useT();
    const form = useForm({
        title: action?.title ?? '',
        description: action?.description ?? '',
        ownerName: action?.ownerName ?? '',
        ownerPosition: action?.ownerPosition ?? '',
        ownerEmail: '',
        unitId: action?.unitId ?? (units.length === 1 ? units[0].id : ''),
        dueDate: action?.dueDate ?? '',
        successIndicator: action?.successIndicator ?? '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const text = (key: 'title' | 'ownerName' | 'ownerPosition', min: number, max: number) => (
        <Field id={`action-${key}`} label={t(`gaps.form.${key}`)} error={errors[key]}>
            <Input
                id={`action-${key}`}
                required
                minLength={min}
                maxLength={max}
                value={form.data[key]}
                onChange={(e) => form.setData(key, e.target.value)}
            />
        </Field>
    );
    return (
        <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{action ? t('gaps.form.titleEdit') : t('gaps.form.titleNew', { code: gap.code })}</DialogTitle>
                    <DialogDescription>{gap.name}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const options = { preserveScroll: true, onSuccess: onClose };
                        if (action) {
                            form.put(GapsController.update.url({ assessment, action: action.id }), options);
                        } else {
                            form.post(GapsController.store.url({ assessment, gap: gap.id }), options);
                        }
                    }}
                >
                    {text('title', 5, 300)}
                    <Field id="action-description" label={t('gaps.form.description')} error={errors.description}>
                        <TextArea
                            id="action-description"
                            rows={2}
                            maxLength={4000}
                            value={form.data.description}
                            onChange={(e) => form.setData('description', e.target.value)}
                        />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {text('ownerName', 2, 200)}
                        {text('ownerPosition', 2, 200)}
                        <Field
                            id="action-email"
                            label={t('gaps.form.ownerEmail')}
                            hint={action?.hasEmail ? t('gaps.form.ownerEmailHint') : undefined}
                            error={errors.ownerEmail}
                        >
                            <Input
                                id="action-email"
                                type="email"
                                autoComplete="off"
                                maxLength={254}
                                value={form.data.ownerEmail}
                                onChange={(e) => form.setData('ownerEmail', e.target.value)}
                            />
                        </Field>
                        <Field id="action-unit" label={t('gaps.form.unit')} error={errors.unitId}>
                            <NativeSelect
                                id="action-unit"
                                value={form.data.unitId}
                                onChange={(e) => form.setData('unitId', e.target.value)}
                            >
                                <option value="">{t('gaps.form.organization')}</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field id="action-due" label={t('gaps.form.dueDate')} error={errors.dueDate}>
                            <Input
                                id="action-due"
                                type="date"
                                required
                                value={form.data.dueDate}
                                onChange={(e) => form.setData('dueDate', e.target.value)}
                            />
                        </Field>
                    </div>
                    <Field id="action-indicator" label={t('gaps.form.successIndicator')} error={errors.successIndicator}>
                        <TextArea
                            id="action-indicator"
                            rows={2}
                            required
                            minLength={5}
                            maxLength={1000}
                            value={form.data.successIndicator}
                            onChange={(e) => form.setData('successIndicator', e.target.value)}
                        />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            {t('gaps.form.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing} data-testid="action-save">
                            {t('gaps.form.save')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
