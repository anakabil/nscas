import { router } from '@inertiajs/react';
import { CheckCircle2, ChevronDown, Circle, Download, Eye, FilePlus2, FileUp, Link2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import EvidenceController from '@/actions/App/Http/Controllers/Evidence/EvidenceController';
import { CollectionShell } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, NativeSelect, TextArea, formatDateTime, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { postJson, sendFile } from '@/lib/upload';
import type { Grant } from '@/lib/upload';
import { cn } from '@/lib/utils';

type Requirement = { id: string; description: string; met: boolean };
type ChecklistRow = {
    characteristicId: string;
    code: string;
    name: string;
    requirements: Requirement[];
    evidenceCount: number;
    types: number;
    belowMinimum: boolean;
};
type LinkInput = { characteristicId: string; requirementIds: string[] };
type Item = {
    id: string;
    title: string;
    description: string | null;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    version: number;
    createdAt: string;
    unitId: string | null;
    unitName: string | null;
    uploadedBy: string | null;
    links: (LinkInput & { code: string })[];
    previousVersions: { id: string; version: number; createdAt: string }[];
};
type Props = CollectionCommon & {
    canEdit: boolean;
    uploadOpen: boolean;
    scoped: boolean;
    units: { id: string; name: string; depth: number }[];
    checklist: { minTypes: number; rows: ChecklistRow[] };
    items: Item[];
    maxBytes: number;
    urls: { grant: string; finalize: string };
};

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx';
const PREVIEWABLE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Ukuran berkas, misalnya "1,2 MB". */
function formatBytes(bytes: number, locale: 'id' | 'en'): string {
    if (bytes < 1024 * 1024) {
        return `${formatNumber(Math.max(1, Math.round(bytes / 1024)), locale)} KB`;
    }
    return `${formatNumber(bytes / (1024 * 1024), locale, 1)} MB`;
}

/** Bukti dokumen per karakteristik (docs/01 M5). */
export default function EvidenceIndex(props: Props) {
    const t = useT();
    const [view, setView] = useState<'checklist' | 'items'>('checklist');
    const [upload, setUpload] = useState<{ previous: Item | null; preset: LinkInput[] } | null>(null);
    const [mapping, setMapping] = useState<Item | null>(null);
    const rows = props.checklist.rows;
    const complete = rows.filter((r) => !r.belowMinimum).length;
    const notice = !props.uploadOpen ? t('evidence.closed') : !props.canEdit ? t('collection.readOnly') : null;

    return (
        <CollectionShell module="evidence" common={props} canEdit={props.canEdit} showWindow={false} notice={notice}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <dl className="grid flex-1 grid-cols-2 gap-3 sm:max-w-xl" data-testid="evidence-summary">
                    <div className="frame-hairline rounded-lg px-4 py-3">
                        <dt className="text-xs text-muted-foreground">
                            {t('evidence.summary.complete', { min: props.checklist.minTypes })}
                        </dt>
                        <dd className="numeral mt-1 font-display text-2xl text-ink">
                            {t('evidence.summary.ofTotal', { count: complete, total: rows.length })}
                        </dd>
                    </div>
                    <div className="frame-hairline rounded-lg px-4 py-3">
                        <dt className="text-xs text-muted-foreground">{t('evidence.summary.items')}</dt>
                        <dd className="numeral mt-1 font-display text-2xl text-ink">{props.items.length}</dd>
                    </div>
                </dl>
                {props.canEdit ? (
                    <Button onClick={() => setUpload({ previous: null, preset: [] })} data-testid="evidence-upload-open">
                        <FileUp aria-hidden />
                        {t('evidence.upload.open')}
                    </Button>
                ) : null}
            </div>
            {props.scoped ? <p className="text-sm text-charcoal">{t('evidence.scoped')}</p> : null}

            <div
                role="tablist"
                aria-label={t('evidence.views.label')}
                className="inline-flex rounded-md border border-border p-1"
            >
                {(['checklist', 'items'] as const).map((key) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={view === key}
                        onClick={() => setView(key)}
                        className={cn(
                            'rounded px-3.5 py-2 text-sm font-medium transition-colors',
                            view === key ? 'bg-maroon text-parchment' : 'text-foreground hover:bg-muted',
                        )}
                        data-testid={`evidence-view-${key}`}
                    >
                        {key === 'checklist'
                            ? t('evidence.views.checklist')
                            : t('evidence.views.items', { count: props.items.length })}
                    </button>
                ))}
            </div>

            {view === 'checklist' ? (
                <ChecklistView
                    rows={rows}
                    minTypes={props.checklist.minTypes}
                    canEdit={props.canEdit}
                    onUpload={(row) =>
                        setUpload({ previous: null, preset: [{ characteristicId: row.characteristicId, requirementIds: [] }] })
                    }
                />
            ) : (
                <ItemsView
                    items={props.items}
                    canEdit={props.canEdit}
                    assessmentId={props.assessment.id}
                    onVersion={(item) => setUpload({ previous: item, preset: [] })}
                    onMap={(item) => setMapping(item)}
                />
            )}

            {upload ? (
                <UploadDialog
                    {...props}
                    previous={upload.previous}
                    preset={upload.preset}
                    onClose={() => setUpload(null)}
                    onDone={() => {
                        setUpload(null);
                        setView('items');
                        router.reload({ only: ['checklist', 'items'] });
                    }}
                />
            ) : null}
            {mapping ? <MappingDialog {...props} item={mapping} onClose={() => setMapping(null)} /> : null}
        </CollectionShell>
    );
}

function ChecklistView({
    rows,
    minTypes,
    canEdit,
    onUpload,
}: {
    rows: ChecklistRow[];
    minTypes: number;
    canEdit: boolean;
    onUpload: (row: ChecklistRow) => void;
}) {
    const t = useT();
    const [open, setOpen] = useState<string | null>(null);
    return (
        <ul className="divide-y divide-border rounded-lg border border-border" data-testid="evidence-checklist">
            {rows.map((row) => {
                const expanded = open === row.characteristicId;
                return (
                    <li key={row.characteristicId} data-code={row.code} data-below={row.belowMinimum ? 'true' : 'false'}>
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : row.characteristicId)}
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-ink">
                                    {row.code} {row.name}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {t('evidence.checklist.items', { count: row.evidenceCount })}
                                </span>
                            </span>
                            <span
                                className={cn(
                                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                                    row.belowMinimum ? 'bg-gold/15 text-gold-deep' : 'bg-success/10 text-success',
                                )}
                            >
                                {t('evidence.checklist.types', { count: row.types, min: minTypes })}
                            </span>
                            <ChevronDown
                                aria-hidden
                                className={cn(
                                    'size-4 shrink-0 text-muted-foreground transition-transform',
                                    expanded && 'rotate-180',
                                )}
                            />
                        </button>
                        {expanded ? (
                            <div className="space-y-3 px-4 pb-4">
                                {row.requirements.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t('evidence.checklist.noItems')}</p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {row.requirements.map((r) => (
                                            <li key={r.id} className="flex items-start gap-2 text-sm">
                                                {r.met ? (
                                                    <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                                                ) : (
                                                    <Circle
                                                        aria-hidden
                                                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                                    />
                                                )}
                                                <span className={r.met ? 'text-ink' : 'text-charcoal'}>
                                                    {r.description}
                                                    <span className="sr-only">
                                                        {' '}
                                                        {r.met ? t('evidence.checklist.met') : t('evidence.checklist.notMet')}
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {canEdit ? (
                                    <Button variant="outline" size="sm" onClick={() => onUpload(row)}>
                                        <FileUp aria-hidden />
                                        {t('evidence.checklist.uploadFor')}
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}

function ItemsView({
    items,
    canEdit,
    assessmentId,
    onVersion,
    onMap,
}: {
    items: Item[];
    canEdit: boolean;
    assessmentId: string;
    onVersion: (item: Item) => void;
    onMap: (item: Item) => void;
}) {
    const t = useT();
    const locale = useLocale();
    if (items.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {t('evidence.items.empty')}
            </p>
        );
    }
    const download = (id: string, inline = false) =>
        EvidenceController.download.url({ assessment: assessmentId, item: id }, inline ? { query: { inline: 1 } } : undefined);

    return (
        <ul className="space-y-3" data-testid="evidence-items">
            {items.map((item) => (
                <li key={item.id} className="frame-hairline space-y-3 rounded-lg p-4 sm:p-5" data-testid="evidence-item">
                    <div className="space-y-1">
                        <p className="font-medium break-words text-ink">{item.title}</p>
                        <p className="text-xs break-words text-muted-foreground">
                            {[
                                item.fileName,
                                formatBytes(item.sizeBytes, locale),
                                t('evidence.items.version', { version: item.version }),
                                item.unitName ?? t('evidence.items.organization'),
                                t('evidence.items.uploaded', {
                                    name: item.uploadedBy ?? '',
                                    date: formatDateTime(item.createdAt, locale),
                                }),
                            ].join(' · ')}
                        </p>
                        {item.description ? <p className="text-sm break-words text-charcoal">{item.description}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5" aria-label={t('evidence.items.mappedTo')}>
                        {item.links.length === 0 ? (
                            <span className="text-xs text-gold-deep">{t('evidence.items.unmapped')}</span>
                        ) : (
                            item.links.map((l) => (
                                <span
                                    key={l.characteristicId}
                                    className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-ink"
                                >
                                    {l.code}
                                </span>
                            ))
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <a href={download(item.id)}>
                                <Download aria-hidden />
                                {t('evidence.items.download')}
                            </a>
                        </Button>
                        {PREVIEWABLE.includes(item.mimeType) ? (
                            <Button asChild variant="outline" size="sm">
                                <a href={download(item.id, true)} target="_blank" rel="noopener">
                                    <Eye aria-hidden />
                                    {t('evidence.items.view')}
                                </a>
                            </Button>
                        ) : null}
                        {canEdit ? (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onMap(item)} data-testid="evidence-map-open">
                                    <Link2 aria-hidden />
                                    {t('evidence.items.map')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onVersion(item)}
                                    data-testid="evidence-version-open"
                                >
                                    <FilePlus2 aria-hidden />
                                    {t('evidence.items.newVersion')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => {
                                        if (window.confirm(t('evidence.items.confirmDelete', { title: item.title }))) {
                                            router.delete(
                                                EvidenceController.destroy.url({ assessment: assessmentId, item: item.id }),
                                                {
                                                    preserveScroll: true,
                                                },
                                            );
                                        }
                                    }}
                                >
                                    <Trash2 aria-hidden />
                                    {t('evidence.items.delete')}
                                </Button>
                            </>
                        ) : null}
                    </div>
                    {item.previousVersions.length > 0 ? (
                        <details className="text-sm">
                            <summary className="cursor-pointer text-charcoal">
                                {t('evidence.items.previous', { count: item.previousVersions.length })}
                            </summary>
                            <ul className="mt-2 space-y-1">
                                {item.previousVersions.map((v) => (
                                    <li key={v.id}>
                                        <a className="text-maroon underline underline-offset-4" href={download(v.id)}>
                                            {t('evidence.items.version', { version: v.version })},{' '}
                                            {formatDateTime(v.createdAt, locale)}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    ) : null}
                    <p className="font-mono text-[0.7rem] break-all text-muted-foreground" title={item.sha256}>
                        SHA-256 {item.sha256}
                    </p>
                </li>
            ))}
        </ul>
    );
}

/** Pilihan karakteristik dan butir daftar periksa yang dipenuhi bukti. */
function MappingPicker({
    rows,
    value,
    onChange,
}: {
    rows: ChecklistRow[];
    value: LinkInput[];
    onChange: (v: LinkInput[]) => void;
}) {
    const t = useT();
    const selected = useMemo(() => new Map(value.map((l) => [l.characteristicId, l.requirementIds])), [value]);
    const toggle = (id: string) =>
        onChange(
            selected.has(id)
                ? value.filter((l) => l.characteristicId !== id)
                : [...value, { characteristicId: id, requirementIds: [] }],
        );
    const toggleRequirement = (id: string, requirementId: string) =>
        onChange(
            value.map((l) =>
                l.characteristicId !== id
                    ? l
                    : {
                          ...l,
                          requirementIds: l.requirementIds.includes(requirementId)
                              ? l.requirementIds.filter((r) => r !== requirementId)
                              : [...l.requirementIds, requirementId],
                      },
            ),
        );

    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('evidence.mapping.title')}</legend>
            <p className="text-xs text-muted-foreground">{t('evidence.mapping.hint')}</p>
            <ul
                className="max-h-[45dvh] divide-y divide-border overflow-y-auto rounded-md border border-border"
                data-testid="evidence-mapping"
            >
                {rows.map((row) => {
                    const checked = selected.has(row.characteristicId);
                    return (
                        <li key={row.characteristicId} className="px-3 py-2">
                            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                                <input
                                    type="checkbox"
                                    className="mt-0.5 size-4 accent-maroon"
                                    checked={checked}
                                    onChange={() => toggle(row.characteristicId)}
                                    data-code={row.code}
                                />
                                <span className={checked ? 'font-medium text-ink' : 'text-foreground'}>
                                    {row.code} {row.name}
                                </span>
                            </label>
                            {checked && row.requirements.length > 0 ? (
                                <div className="mt-2 ml-6 space-y-1.5">
                                    <p className="text-xs text-muted-foreground">{t('evidence.mapping.requirements')}</p>
                                    {row.requirements.map((r) => (
                                        <label key={r.id} className="flex cursor-pointer items-start gap-2 text-xs text-charcoal">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 size-3.5 accent-maroon"
                                                checked={selected.get(row.characteristicId)?.includes(r.id) ?? false}
                                                onChange={() => toggleRequirement(row.characteristicId, r.id)}
                                            />
                                            <span>{r.description}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </fieldset>
    );
}

function UploadDialog({
    previous,
    preset,
    onClose,
    onDone,
    ...props
}: Props & { previous: Item | null; preset: LinkInput[]; onClose: () => void; onDone: () => void }) {
    const t = useT();
    const locale = useLocale();
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState(previous?.title ?? '');
    const [description, setDescription] = useState(previous?.description ?? '');
    const [unitId, setUnitId] = useState<string>(previous?.unitId ?? (props.scoped ? (props.units[0]?.id ?? '') : ''));
    const [links, setLinks] = useState<LinkInput[]>(preset);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const busy = progress !== null;

    const choose = (picked: File | null) => {
        setError(null);
        if (picked && picked.size > props.maxBytes) {
            setFile(null);
            setError(t('evidence.upload.tooLarge'));
            return;
        }
        setFile(picked);
        if (picked && title.trim() === '') {
            setTitle(picked.name.replace(/\.[^.]+$/, '').slice(0, 300));
        }
    };

    const submit = async () => {
        if (!file) {
            return;
        }
        setError(null);
        setProgress(0);
        const granted = await postJson<Grant>(props.urls.grant, {
            fileName: file.name,
            size: file.size,
            contentType: file.type,
            title: title.trim(),
            description: description.trim(),
            unitId: previous ? null : unitId || null,
            supersedesId: previous?.id ?? null,
        });
        if (!granted.ok) {
            setProgress(null);
            setError(granted.message ?? t('evidence.upload.failed'));
            return;
        }
        const sent = await sendFile(granted.data.upload, file, (f) => setProgress(f * 0.95));
        if (!sent) {
            setProgress(null);
            setError(t('evidence.upload.failed'));
            return;
        }
        const finished = await postJson<{ id: string }>(props.urls.finalize, {
            ticket: granted.data.ticket,
            ...(previous ? {} : { links }),
        });
        if (!finished.ok) {
            setProgress(null);
            setError(finished.message ?? t('evidence.upload.failed'));
            return;
        }
        setProgress(1);
        onDone();
    };

    return (
        <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="evidence-upload-dialog">
                <DialogHeader>
                    <DialogTitle>
                        {previous
                            ? t('evidence.upload.versionTitle', { version: previous.version + 1 })
                            : t('evidence.upload.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('evidence.upload.hint', { max: formatBytes(props.maxBytes, locale) })}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    <Field id="evidence-file" label={t('evidence.upload.file')}>
                        <Input
                            id="evidence-file"
                            type="file"
                            accept={ACCEPT}
                            required
                            disabled={busy}
                            onChange={(e) => choose(e.target.files?.[0] ?? null)}
                        />
                    </Field>
                    <Field id="evidence-title" label={t('evidence.upload.name')}>
                        <Input
                            id="evidence-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            minLength={2}
                            maxLength={300}
                            disabled={busy}
                        />
                    </Field>
                    {previous ? null : (
                        <Field id="evidence-unit" label={t('evidence.upload.unit')}>
                            <NativeSelect
                                id="evidence-unit"
                                value={unitId}
                                onChange={(e) => setUnitId(e.target.value)}
                                disabled={busy}
                            >
                                {props.scoped ? null : <option value="">{t('evidence.items.organization')}</option>}
                                {props.units.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {' '.repeat(u.depth * 3)}
                                        {u.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                    )}
                    <Field id="evidence-description" label={t('evidence.upload.description')}>
                        <TextArea
                            id="evidence-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={2000}
                            rows={2}
                            className="min-h-16"
                            disabled={busy}
                        />
                    </Field>
                    {previous ? (
                        <p className="text-sm text-muted-foreground">{t('evidence.upload.inherits')}</p>
                    ) : (
                        <MappingPicker rows={props.checklist.rows} value={links} onChange={setLinks} />
                    )}
                    <FormError message={error ?? undefined} />
                    {busy ? (
                        <div
                            className="h-2 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round((progress ?? 0) * 100)}
                            aria-label={t('evidence.upload.progress')}
                        >
                            <div className="h-full bg-maroon transition-[width]" style={{ width: `${(progress ?? 0) * 100}%` }} />
                        </div>
                    ) : null}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                            {t('evidence.upload.cancel')}
                        </Button>
                        <Button type="submit" disabled={busy || !file} data-testid="evidence-upload-submit">
                            {busy ? t('evidence.upload.sending') : t('evidence.upload.submit')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function MappingDialog({ item, onClose, ...props }: Props & { item: Item; onClose: () => void }) {
    const t = useT();
    const [links, setLinks] = useState<LinkInput[]>(
        item.links.map((l) => ({ characteristicId: l.characteristicId, requirementIds: l.requirementIds })),
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="evidence-mapping-dialog">
                <DialogHeader>
                    <DialogTitle>{t('evidence.mapping.dialogTitle')}</DialogTitle>
                    <DialogDescription className="break-words">{item.title}</DialogDescription>
                </DialogHeader>
                <MappingPicker rows={props.checklist.rows} value={links} onChange={setLinks} />
                <FormError message={error ?? undefined} />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                        {t('evidence.upload.cancel')}
                    </Button>
                    <Button
                        type="button"
                        disabled={busy}
                        data-testid="evidence-mapping-save"
                        onClick={() => {
                            setBusy(true);
                            router.put(
                                EvidenceController.updateLinks.url({ assessment: props.assessment.id, item: item.id }),
                                { links },
                                {
                                    preserveScroll: true,
                                    onSuccess: () => onClose(),
                                    onError: (errors) => setError(Object.values(errors)[0] ?? t('evidence.upload.failed')),
                                    onFinish: () => setBusy(false),
                                },
                            );
                        }}
                    >
                        {t('evidence.mapping.save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
