import { router, useForm } from '@inertiajs/react';
import { Copy, Download, FileSpreadsheet, Mail, RotateCcw, Search, Send, ShieldOff, UserMinus } from 'lucide-react';
import { useState } from 'react';
import RespondentController from '@/actions/App/Http/Controllers/Respondents/RespondentController';
import { CollectionShell } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, NativeSelect, Panel, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

type UnitOption = { id: string; name: string; depth: number };
type RowError = { row: number; column: string | null; code: string };
type Preview = {
    ok: boolean;
    error: string | null;
    imported: number;
    commit: boolean;
    fileName: string;
    maxRows: number;
    summary: {
        missingColumns: string[];
        tooManyRows: boolean;
        totalRows: number;
        validRows: number;
        errorCount: number;
        errors: RowError[];
        byUnit: { unitId: string; name: string; count: number }[];
        byStratum: { stratumId: string; code: string; count: number }[];
    } | null;
};
type IssuedLink = { fullName: string; employeeNo: string | null; unit: string; stratum: string; link: string };
type RosterRow = {
    id: string;
    fullName: string;
    employeeNo: string | null;
    email: string | null;
    phone: string | null;
    isContractor: boolean;
    unit: string;
    stratum: string;
    tokenState: 'NONE' | 'ISSUED' | 'REVOKED';
};
type Coordinators = {
    assignments: { id: number; unit: string; name: string; email: string }[];
    candidates: { id: number; name: string; email: string }[];
};

type Props = CollectionCommon & {
    can: { import: boolean; distribute: boolean; window: boolean; assign: boolean };
    scoped: boolean;
    summary: { registered: number; withEmail: number; tokens: number };
    units: UnitOption[];
    strata: { id: string; code: string; name: string }[];
    filters: { search: string; unit: string };
    roster: { total: number; page: number; pages: number; rows: RosterRow[] };
    coordinators: Coordinators | null;
    preview: Preview | null;
    issuedLinks: IssuedLink[] | null;
    notice: { key: string; count?: number } | null;
};

/** Nilai isian datetime-local dalam WIB dari waktu ISO. */
function toWibInput(value: string | null): string {
    if (!value) {
        return '';
    }
    const shifted = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 16);
}

/** Sel CSV aman: diberi kutip, dan awalan rumus (=, +, -, @) dinetralkan agar tidak dijalankan Excel. */
function csvCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
}

function downloadLinksCsv(links: IssuedLink[], headers: string[], fileName: string) {
    // Pemisah titik koma dan BOM agar langsung terbaca rapi oleh Excel berbahasa Indonesia.
    const lines = [headers, ...links.map((l) => [l.fullName, l.employeeNo ?? '', l.unit, l.stratum, l.link])].map((row) =>
        row.map(csvCell).join(';'),
    );
    const blob = new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function UnitSelect({
    id,
    units,
    value,
    onChange,
    allLabel,
}: {
    id: string;
    units: UnitOption[];
    value: string;
    onChange: (v: string) => void;
    allLabel: string;
}) {
    return (
        <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">{allLabel}</option>
            {units.map((u) => (
                <option key={u.id} value={u.id}>
                    {'  '.repeat(u.depth)}
                    {u.name}
                </option>
            ))}
        </NativeSelect>
    );
}

/** Halaman responden dan undangan (tahap 2, docs/01 M2). */
export default function RespondentsIndex(props: Props) {
    const t = useT();
    const locale = useLocale();
    const assessment = props.assessment.id;
    const canEdit = props.can.import || props.can.distribute || props.can.window;

    return (
        <CollectionShell module="respondents" common={props} canEdit={canEdit}>
            <div className="max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>{t('respondents.intro')}</p>
                {props.scoped ? <p className="text-charcoal">{t('respondents.scoped')}</p> : null}
            </div>

            <dl className="grid gap-4 sm:grid-cols-3" data-testid="respondent-summary">
                {(['registered', 'withEmail', 'tokens'] as const).map((key) => (
                    <div key={key} className="frame-hairline rounded-lg px-5 py-4">
                        <dt className="text-xs text-muted-foreground">{t(`respondents.summary.${key}`)}</dt>
                        <dd className="numeral mt-1 font-display text-3xl text-ink">
                            {formatNumber(props.summary[key], locale)}
                        </dd>
                    </div>
                ))}
            </dl>

            {props.notice ? (
                <p role="status" className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                    {t(`respondents.notices.${props.notice.key}`, { count: formatNumber(props.notice.count ?? 0, locale) })}
                </p>
            ) : null}
            {props.issuedLinks && props.issuedLinks.length > 0 ? <IssuedLinks links={props.issuedLinks} /> : null}

            {props.can.window ? <WindowForm assessment={assessment} common={props} /> : null}
            {props.can.import ? <ImportForm assessment={assessment} preview={props.preview} /> : null}
            {props.can.distribute ? <Distribution assessment={assessment} units={props.units} /> : null}
            {props.coordinators ? (
                <CoordinatorPanel
                    assessment={assessment}
                    coordinators={props.coordinators}
                    units={props.units}
                    canAssign={props.can.assign}
                />
            ) : null}
            <RosterTable {...props} />
        </CollectionShell>
    );
}

function WindowForm({ assessment, common }: { assessment: string; common: CollectionCommon }) {
    const t = useT();
    const form = useForm({ opens_at: toWibInput(common.window.opensAt), closes_at: toWibInput(common.window.closesAt) });
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.put(RespondentController.window.url(assessment), { preserveScroll: true });
            }}
        >
            <Panel title={t('respondents.window.title')} hint={t('respondents.window.intro')}>
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="window-opens" label={t('respondents.window.opensAt')} error={form.errors.opens_at}>
                        <Input
                            id="window-opens"
                            type="datetime-local"
                            required
                            value={form.data.opens_at}
                            onChange={(e) => form.setData('opens_at', e.target.value)}
                        />
                    </Field>
                    <Field id="window-closes" label={t('respondents.window.closesAt')} error={form.errors.closes_at}>
                        <Input
                            id="window-closes"
                            type="datetime-local"
                            required
                            value={form.data.closes_at}
                            onChange={(e) => form.setData('closes_at', e.target.value)}
                        />
                    </Field>
                </div>
                <Button type="submit" disabled={form.processing}>
                    {form.processing ? t('common.saving') : t('respondents.window.save')}
                </Button>
            </Panel>
        </form>
    );
}

function ImportForm({ assessment, preview }: { assessment: string; preview: Preview | null }) {
    const t = useT();
    const locale = useLocale();
    const form = useForm<{ file: File | null; commit: boolean }>({ file: null, commit: false });
    const errors = form.errors as Record<string, string | undefined>;
    const submit = (commit: boolean) => {
        form.transform((data) => ({ ...data, commit }));
        form.post(RespondentController.importMethod.url(assessment), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                if (commit) {
                    form.reset();
                }
            },
        });
    };
    const summary = preview?.summary;
    const canCommit = preview?.ok && !preview.commit && form.data.file !== null;

    return (
        <Panel title={t('respondents.import.title')} hint={t('respondents.import.intro')}>
            <a
                href={RespondentController.template.url(assessment)}
                className="inline-flex items-center gap-2 text-sm font-medium text-maroon underline-offset-4 hover:underline"
            >
                <FileSpreadsheet aria-hidden className="size-4" />
                {t('respondents.import.template')}
            </a>
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit(false);
                }}
            >
                <Field
                    id="roster-file"
                    label={t('respondents.import.file')}
                    hint={t('respondents.import.fileHint', { max: formatNumber(20000, locale) })}
                    error={errors.file}
                >
                    <Input
                        id="roster-file"
                        type="file"
                        required
                        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                    />
                </Field>
                <div className="flex flex-wrap gap-3">
                    <Button type="submit" variant="outline" disabled={form.processing || form.data.file === null}>
                        {form.processing && !form.data.commit
                            ? t('respondents.import.previewing')
                            : t('respondents.import.preview')}
                    </Button>
                    {canCommit ? (
                        <Button type="button" disabled={form.processing} onClick={() => submit(true)} data-testid="roster-commit">
                            {form.processing
                                ? t('respondents.import.committing')
                                : t('respondents.import.commit', { count: formatNumber(summary?.validRows ?? 0, locale) })}
                        </Button>
                    ) : null}
                </div>
            </form>

            {preview ? (
                <div className="space-y-4 border-t border-border pt-5" data-testid="roster-preview">
                    {preview.error && preview.error !== 'INVALID_ROWS' ? (
                        <FormError message={t(`respondents.import.fileErrors.${preview.error}`)} />
                    ) : null}
                    {preview.commit && preview.ok ? (
                        <p
                            role="status"
                            className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
                        >
                            {t('respondents.import.imported', { count: formatNumber(preview.imported, locale) })}
                        </p>
                    ) : null}
                    {summary ? (
                        <>
                            {summary.missingColumns.length > 0 ? (
                                <FormError
                                    message={t('respondents.import.missingColumns', {
                                        columns: summary.missingColumns.map((c) => t(`respondents.columns.${c}`)).join(', '),
                                    })}
                                />
                            ) : null}
                            {summary.tooManyRows ? (
                                <FormError
                                    message={t('respondents.import.tooManyRows', { max: formatNumber(preview.maxRows, locale) })}
                                />
                            ) : null}
                            <dl className="grid gap-3 text-sm sm:grid-cols-3">
                                <div>
                                    <dt className="text-muted-foreground">{t('respondents.import.rows')}</dt>
                                    <dd className="numeral text-lg text-ink">{formatNumber(summary.totalRows, locale)}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">{t('respondents.import.valid')}</dt>
                                    <dd className="numeral text-lg text-ink">{formatNumber(summary.validRows, locale)}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">{t('respondents.import.errorCount')}</dt>
                                    <dd className={`numeral text-lg ${summary.errorCount > 0 ? 'text-destructive' : 'text-ink'}`}>
                                        {formatNumber(summary.errorCount, locale)}
                                    </dd>
                                </div>
                            </dl>
                            {preview.ok && !preview.commit ? (
                                <p className="text-sm text-success">{t('respondents.import.ready')}</p>
                            ) : null}
                            {!preview.ok && preview.error === 'INVALID_ROWS' ? (
                                <p className="text-sm text-charcoal">{t('respondents.import.fixAndRetry')}</p>
                            ) : null}
                            {summary.errors.length > 0 ? (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-ink">{t('respondents.import.errorsTitle')}</h4>
                                    {summary.errorCount > summary.errors.length ? (
                                        <p className="text-xs text-muted-foreground">
                                            {t('respondents.import.errorsTruncated', {
                                                shown: formatNumber(summary.errors.length, locale),
                                                total: formatNumber(summary.errorCount, locale),
                                            })}
                                        </p>
                                    ) : null}
                                    <div className="max-h-80 overflow-auto rounded-md border border-border">
                                        <table className="w-full text-left text-sm">
                                            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                                                <tr>
                                                    <th className="px-3 py-2">{t('respondents.import.rowNumber')}</th>
                                                    <th className="px-3 py-2">{t('respondents.import.column')}</th>
                                                    <th className="px-3 py-2">{t('respondents.import.problem')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {summary.errors.map((err, i) => (
                                                    <tr key={i}>
                                                        <td className="numeral px-3 py-1.5">{err.row}</td>
                                                        <td className="px-3 py-1.5">
                                                            {err.column ? t(`respondents.columns.${err.column}`) : ''}
                                                        </td>
                                                        <td className="px-3 py-1.5">{t(`respondents.rowErrors.${err.code}`)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                            {summary.byUnit.length > 0 ? (
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <CountList
                                        title={t('respondents.import.byUnit')}
                                        rows={summary.byUnit.map((u) => [u.name, u.count])}
                                    />
                                    <CountList
                                        title={t('respondents.import.byStratum')}
                                        rows={summary.byStratum.map((s) => [s.code, s.count])}
                                    />
                                </div>
                            ) : null}
                        </>
                    ) : null}
                </div>
            ) : null}
        </Panel>
    );
}

function CountList({ title, rows }: { title: string; rows: [string, number][] }) {
    const t = useT();
    const locale = useLocale();
    return (
        <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">{title}</h4>
            <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                    <tr>
                        <th className="py-1 text-left font-normal" />
                        <th className="py-1 text-right font-normal">{t('respondents.import.count')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {rows.map(([label, count]) => (
                        <tr key={label}>
                            <td className="py-1.5">{label}</td>
                            <td className="numeral py-1.5 text-right">{formatNumber(count, locale)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Distribution({ assessment, units }: { assessment: string; units: UnitOption[] }) {
    const t = useT();
    const invite = useForm({ unit_id: '' });
    const links = useForm({ unit_id: '', only_without_email: true });
    const unitless = (v: string) => (v === '' ? null : v);

    return (
        <Panel title={t('respondents.distribution.title')}>
            <div className="grid gap-6 lg:grid-cols-2">
                <form
                    className="space-y-4 rounded-md border border-border p-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        invite.transform((d) => ({ unit_id: unitless(d.unit_id) }));
                        invite.post(RespondentController.invitations.url(assessment), { preserveScroll: true });
                    }}
                >
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Mail aria-hidden className="size-4 text-gold-deep" />
                        {t('respondents.distribution.invite.title')}
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t('respondents.distribution.invite.intro')}</p>
                    <Field id="invite-unit" label={t('respondents.distribution.unitFilter')}>
                        <UnitSelect
                            id="invite-unit"
                            units={units}
                            value={invite.data.unit_id}
                            onChange={(v) => invite.setData('unit_id', v)}
                            allLabel={t('respondents.distribution.allUnits')}
                        />
                    </Field>
                    <Button type="submit" disabled={invite.processing}>
                        <Send aria-hidden />
                        {invite.processing
                            ? t('respondents.distribution.invite.pending')
                            : t('respondents.distribution.invite.submit')}
                    </Button>
                </form>
                <form
                    className="space-y-4 rounded-md border border-border p-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        links.transform((d) => ({ unit_id: unitless(d.unit_id), only_without_email: d.only_without_email }));
                        links.post(RespondentController.links.url(assessment), { preserveScroll: true });
                    }}
                >
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Copy aria-hidden className="size-4 text-gold-deep" />
                        {t('respondents.distribution.links.title')}
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t('respondents.distribution.links.intro')}</p>
                    <Field id="links-unit" label={t('respondents.distribution.unitFilter')}>
                        <UnitSelect
                            id="links-unit"
                            units={units}
                            value={links.data.unit_id}
                            onChange={(v) => links.setData('unit_id', v)}
                            allLabel={t('respondents.distribution.allUnits')}
                        />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="size-4 accent-maroon"
                            checked={links.data.only_without_email}
                            onChange={(e) => links.setData('only_without_email', e.target.checked)}
                        />
                        {t('respondents.distribution.links.onlyWithoutEmail')}
                    </label>
                    <Button type="submit" variant="outline" disabled={links.processing}>
                        {links.processing
                            ? t('respondents.distribution.links.pending')
                            : t('respondents.distribution.links.submit')}
                    </Button>
                </form>
            </div>
        </Panel>
    );
}

function IssuedLinks({ links }: { links: IssuedLink[] }) {
    const t = useT();
    const locale = useLocale();
    const [copied, setCopied] = useState<number | null>(null);
    const headers = (['name', 'employeeNo', 'unit', 'stratum'] as const)
        .map((c) => t(`respondents.columns.${c}`))
        .concat(t('respondents.distribution.links.link'));

    return (
        <Panel
            title={t('respondents.distribution.links.issued', { count: formatNumber(links.length, locale) })}
            hint={t('respondents.distribution.links.once')}
            className="border-gold/60"
        >
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    onClick={() => downloadLinksCsv(links, headers, t('respondents.distribution.links.fileName'))}
                    data-testid="links-download"
                >
                    <Download aria-hidden />
                    {t('respondents.distribution.links.download')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('respondents.distribution.links.warning')}</p>
            </div>
            <div className="max-h-96 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-sm" data-testid="issued-links">
                    <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                        <tr>
                            {headers.map((h) => (
                                <th key={h} className="px-3 py-2">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {links.map((l, i) => (
                            <tr key={l.link}>
                                <td className="px-3 py-1.5">{l.fullName}</td>
                                <td className="px-3 py-1.5">{l.employeeNo ?? ''}</td>
                                <td className="px-3 py-1.5">{l.unit}</td>
                                <td className="px-3 py-1.5">{l.stratum}</td>
                                <td className="px-3 py-1.5">
                                    <div className="flex items-center gap-2">
                                        <code className="max-w-56 truncate text-xs">{l.link}</code>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                void navigator.clipboard?.writeText(l.link);
                                                setCopied(i);
                                            }}
                                        >
                                            {copied === i
                                                ? t('respondents.distribution.links.copied')
                                                : t('respondents.distribution.links.copy')}
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

function CoordinatorPanel({
    assessment,
    coordinators,
    units,
    canAssign,
}: {
    assessment: string;
    coordinators: Coordinators;
    units: UnitOption[];
    canAssign: boolean;
}) {
    const t = useT();
    const form = useForm({ user_id: '', unit_id: '' });
    const errors = form.errors as Record<string, string | undefined>;
    return (
        <Panel title={t('respondents.coordinators.title')} hint={t('respondents.coordinators.intro')}>
            {coordinators.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('respondents.coordinators.empty')}</p>
            ) : (
                <ul className="divide-y divide-border">
                    {coordinators.assignments.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink">{a.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                            </div>
                            <span className="text-sm text-charcoal">{a.unit}</span>
                            {canAssign ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                t('respondents.coordinators.confirmRemove', { name: a.name, unit: a.unit }),
                                            )
                                        ) {
                                            router.delete(RespondentController.unassign.url({ assessment, assignment: a.id }), {
                                                preserveScroll: true,
                                            });
                                        }
                                    }}
                                >
                                    <UserMinus aria-hidden />
                                    {t('respondents.coordinators.remove')}
                                </Button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
            {canAssign ? (
                coordinators.candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('respondents.coordinators.noCandidates')}</p>
                ) : (
                    <form
                        className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.transform((d) => ({ user_id: Number(d.user_id), unit_id: d.unit_id }));
                            form.post(RespondentController.assign.url(assessment), {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                    >
                        <Field
                            id="coordinator-user"
                            label={t('respondents.coordinators.user')}
                            error={errors.userId ?? errors.user_id}
                        >
                            <NativeSelect
                                id="coordinator-user"
                                required
                                value={form.data.user_id}
                                onChange={(e) => form.setData('user_id', e.target.value)}
                            >
                                <option value="">{t('respondents.coordinators.choose')}</option>
                                {coordinators.candidates.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.email})
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field id="coordinator-unit" label={t('respondents.coordinators.unit')} error={errors.unit_id}>
                            <NativeSelect
                                id="coordinator-unit"
                                required
                                value={form.data.unit_id}
                                onChange={(e) => form.setData('unit_id', e.target.value)}
                            >
                                <option value="">{t('respondents.coordinators.choose')}</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {'  '.repeat(u.depth)}
                                        {u.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Button type="submit" disabled={form.processing}>
                            {t('respondents.coordinators.assign')}
                        </Button>
                    </form>
                )
            ) : null}
        </Panel>
    );
}

function RosterTable(props: Props) {
    const t = useT();
    const locale = useLocale();
    const assessment = props.assessment.id;
    const [search, setSearch] = useState(props.filters.search);
    const [unit, setUnit] = useState(props.filters.unit);
    const [error, setError] = useState<string | undefined>();
    const go = (page: number) =>
        router.get(
            RespondentController.index.url(assessment),
            { search: search || undefined, unit: unit || undefined, page: page > 1 ? page : undefined },
            { preserveScroll: true, preserveState: true },
        );
    const act = (url: string, data: Record<string, string> = {}) =>
        router.post(url, data, { preserveScroll: true, onError: (errs) => setError(errs.form ?? Object.values(errs)[0]) });

    return (
        <Panel title={t('respondents.table.title')} hint={t('respondents.table.privacy')}>
            <form
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-end"
                onSubmit={(e) => {
                    e.preventDefault();
                    go(1);
                }}
            >
                <Field id="roster-search" label={t('respondents.table.search')}>
                    <Input id="roster-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
                </Field>
                <Field id="roster-unit" label={t('respondents.distribution.unitFilter')}>
                    <UnitSelect
                        id="roster-unit"
                        units={props.units}
                        value={unit}
                        onChange={setUnit}
                        allLabel={t('respondents.distribution.allUnits')}
                    />
                </Field>
                <Button type="submit" variant="outline">
                    <Search aria-hidden />
                    {t('respondents.table.apply')}
                </Button>
            </form>
            <FormError message={error} />
            <p className="text-xs text-muted-foreground">
                {t('respondents.table.total', { count: formatNumber(props.roster.total, locale) })}
            </p>
            {props.roster.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('respondents.table.empty')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[56rem] text-left text-sm" data-testid="roster-table">
                        <thead className="border-b border-border text-xs text-muted-foreground">
                            <tr>
                                <th className="py-2 pr-3">{t('respondents.columns.name')}</th>
                                <th className="py-2 pr-3">{t('respondents.columns.unit')}</th>
                                <th className="py-2 pr-3">{t('respondents.columns.stratum')}</th>
                                <th className="py-2 pr-3">{t('respondents.columns.email')}</th>
                                <th className="py-2 pr-3">{t('respondents.columns.phone')}</th>
                                <th className="py-2 pr-3">{t('respondents.table.token')}</th>
                                {props.can.distribute ? <th className="py-2">{t('respondents.table.actions')}</th> : null}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {props.roster.rows.map((r) => (
                                <tr key={r.id}>
                                    <td className="py-2 pr-3">
                                        <p className="font-medium text-ink">{r.fullName}</p>
                                        {r.employeeNo ? <p className="text-xs text-muted-foreground">{r.employeeNo}</p> : null}
                                    </td>
                                    <td className="py-2 pr-3">{r.unit}</td>
                                    <td className="py-2 pr-3">
                                        {r.stratum}
                                        {r.isContractor ? (
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({t('respondents.columns.contractor')})
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="max-w-48 truncate py-2 pr-3">{r.email ?? ''}</td>
                                    <td className="py-2 pr-3">{r.phone ?? ''}</td>
                                    <td className="py-2 pr-3">{t(`respondents.table.tokenStates.${r.tokenState}`)}</td>
                                    {props.can.distribute ? (
                                        <td className="py-2">
                                            <div className="flex flex-wrap gap-1">
                                                {r.tokenState === 'ISSUED' ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            if (window.confirm(t('respondents.table.confirmRevoke'))) {
                                                                act(RespondentController.revoke.url({ assessment, entry: r.id }));
                                                            }
                                                        }}
                                                    >
                                                        <ShieldOff aria-hidden />
                                                        {t('respondents.table.revoke')}
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        act(RespondentController.reissue.url({ assessment, entry: r.id }), {
                                                            channel: 'LINK',
                                                        })
                                                    }
                                                >
                                                    <RotateCcw aria-hidden />
                                                    {t('respondents.table.reissueLink')}
                                                </Button>
                                                {r.email ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            act(RespondentController.reissue.url({ assessment, entry: r.id }), {
                                                                channel: 'EMAIL',
                                                            })
                                                        }
                                                    >
                                                        <Mail aria-hidden />
                                                        {t('respondents.table.reissueEmail')}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {props.roster.pages > 1 ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={props.roster.page <= 1}
                        onClick={() => go(props.roster.page - 1)}
                    >
                        {t('respondents.table.previous')}
                    </Button>
                    <span className="text-muted-foreground">
                        {t('respondents.table.page', { page: props.roster.page, pages: props.roster.pages })}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={props.roster.page >= props.roster.pages}
                        onClick={() => go(props.roster.page + 1)}
                    >
                        {t('respondents.table.next')}
                    </Button>
                </div>
            ) : null}
        </Panel>
    );
}
