import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useState } from 'react';
import AuditTrailController from '@/actions/App/Http/Controllers/Audit/AuditTrailController';
import { actionLabel, categoryLabel } from '@/components/nscas/audit-labels';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, NativeSelect, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

type Entry = {
    id: number;
    at: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    actor: string | null;
    actorEmail: string | null;
    role: string | null;
    ipHash: string | null;
    changes: unknown;
};
type Filters = {
    category: string | null;
    from: string | null;
    to: string | null;
    page: number;
};
type Props = CollectionCommon & {
    filters: Filters;
    categories: string[];
    full: boolean;
    canExport: boolean;
    entries: Entry[];
    total: number;
    page: number;
    pages: number;
};

/** Jejak audit satu asesmen (docs/04 bagian 6). */
export default function AuditTrail(props: Props) {
    const t = useT();
    const locale = useLocale();
    const assessment = props.assessment.id;
    const [draft, setDraft] = useState({
        category: props.filters.category ?? '',
        from: props.filters.from ?? '',
        to: props.filters.to ?? '',
    });
    const active = Object.fromEntries(
        Object.entries({
            category: props.filters.category,
            from: props.filters.from,
            to: props.filters.to,
        }).filter(([, v]) => v),
    ) as Record<string, string>;
    const go = (query: Record<string, string | number>) =>
        router.get(AuditTrailController.index.url(assessment), query, {
            preserveScroll: true,
            preserveState: true,
        });

    return (
        <CollectionShell
            module="audit"
            common={props}
            canEdit={false}
            showWindow={false}
            notice={props.full ? null : t('auditPage.summaryOnly')}
        >
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('auditPage.intro')}</p>
            <form
                className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    go(Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '')));
                }}
                data-testid="audit-filters"
            >
                <Field id="audit-category" label={t('auditPage.filters.category')} className="col-span-2 min-w-0 lg:col-span-1">
                    <NativeSelect
                        id="audit-category"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    >
                        <option value="">{t('auditPage.filters.all')}</option>
                        {props.categories.map((c) => (
                            <option key={c} value={c}>
                                {categoryLabel(t, c)}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>
                <Field id="audit-from" label={t('auditPage.filters.from')} className="min-w-0">
                    <Input
                        id="audit-from"
                        type="date"
                        value={draft.from}
                        max={draft.to || undefined}
                        onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                    />
                </Field>
                <Field id="audit-to" label={t('auditPage.filters.to')} className="min-w-0">
                    <Input
                        id="audit-to"
                        type="date"
                        value={draft.to}
                        min={draft.from || undefined}
                        onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                    />
                </Field>
                <div className="col-span-2 flex flex-wrap items-end gap-2 lg:col-span-1">
                    <Button type="submit">{t('auditPage.filters.apply')}</Button>
                    {Object.keys(active).length > 0 ? (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setDraft({ category: '', from: '', to: '' });
                                go({});
                            }}
                        >
                            {t('auditPage.filters.reset')}
                        </Button>
                    ) : null}
                </div>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-charcoal" data-testid="audit-total">
                    {t('auditPage.total', {
                        count: formatNumber(props.total, locale),
                    })}
                </p>
                {props.canExport && props.total > 0 ? (
                    <Button asChild variant="outline" size="sm">
                        <a
                            href={AuditTrailController.export.url(assessment, {
                                query: active,
                            })}
                            title={t('auditPage.exportHint')}
                            data-testid="audit-export"
                        >
                            <Download aria-hidden />
                            {t('auditPage.export')}
                        </a>
                    </Button>
                ) : null}
            </div>
            {props.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('auditPage.empty')}</p>
            ) : (
                <ol className="divide-y divide-border rounded-lg border border-border" data-testid="audit-entries">
                    {props.entries.map((e) => (
                        <li key={e.id} className="min-w-0 space-y-1.5 px-4 py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <p className="font-medium text-ink">{actionLabel(t, e.action)}</p>
                                <time className="text-xs text-muted-foreground tabular-nums" dateTime={e.at}>
                                    {formatWib(e.at, locale)}
                                </time>
                            </div>
                            <p className="text-xs text-charcoal">
                                {e.actor ?? t('auditPage.system')}
                                {e.role ? `, ${t(`roles.${e.role}.name`)}` : ''}
                                {e.actorEmail ? (
                                    <span className="hidden text-muted-foreground sm:inline"> ({e.actorEmail})</span>
                                ) : null}
                            </p>
                            {props.full && e.changes !== null ? (
                                <details className="group">
                                    <summary className="cursor-pointer text-xs font-medium text-gold-deep select-none">
                                        {t('auditPage.details')}
                                    </summary>
                                    <pre className="relative mt-2 max-h-72 overflow-auto rounded-md bg-muted/60 p-3 text-[0.72rem] leading-relaxed break-words whitespace-pre-wrap text-charcoal">
                                        {JSON.stringify(e.changes, null, 2)}
                                    </pre>
                                </details>
                            ) : null}
                        </li>
                    ))}
                </ol>
            )}
            {props.pages > 1 ? (
                <nav
                    className="flex items-center justify-between gap-3"
                    aria-label={t('auditPage.page', {
                        page: props.page,
                        pages: props.pages,
                    })}
                >
                    {props.page > 1 ? (
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={AuditTrailController.index.url(assessment, {
                                    query: {
                                        ...active,
                                        page: props.page - 1,
                                    },
                                })}
                                preserveScroll
                            >
                                <ChevronLeft aria-hidden />
                                {t('auditPage.previous')}
                            </Link>
                        </Button>
                    ) : (
                        <span />
                    )}
                    <span className="text-sm text-muted-foreground">
                        {t('auditPage.page', {
                            page: formatNumber(props.page, locale),
                            pages: formatNumber(props.pages, locale),
                        })}
                    </span>
                    {props.page < props.pages ? (
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={AuditTrailController.index.url(assessment, {
                                    query: {
                                        ...active,
                                        page: props.page + 1,
                                    },
                                })}
                                preserveScroll
                            >
                                {t('auditPage.next')}
                                <ChevronRight aria-hidden />
                            </Link>
                        </Button>
                    ) : (
                        <span />
                    )}
                </nav>
            ) : null}
        </CollectionShell>
    );
}
