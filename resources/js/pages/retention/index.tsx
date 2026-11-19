import { Head, useForm, usePage } from '@inertiajs/react';
import { CircleCheck, ExternalLink, FileDown, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import RetentionController from '@/actions/App/Http/Controllers/RetentionController';
import { ACCOUNT_ICONS } from '@/components/icons/module-icons';
import { Container } from '@/components/nscas/parts';
import { Field, FormError, TextArea } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Row = {
    id: string;
    name: string;
    organization: string | null;
    status: string;
    baseline: string | null;
    dueAt: string | null;
    months: number;
    state: 'active' | 'expired' | 'flagged' | 'destroyed';
    flaggedAt: string | null;
    canDestroy: boolean;
    record: {
        id: string;
        executedAt: string;
        objectCount: number;
        objectsPurged: boolean;
    } | null;
};

/** Tanggal dalam WIB dari waktu ISO 8601, misalnya "10 Januari 2029". */
function formatDay(value: string, locale: 'id' | 'en'): string {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
}

/** Retensi data (docs/04 bagian 7): masa simpan dan pemusnahan data mentah. Hanya pengelola sistem. */
export default function Retention({ rows }: { rows: Row[] }) {
    const t = useT();
    const locale = useLocale();
    const { flash } = usePage<{ flash?: { status?: string | null } }>().props;
    const [open, setOpen] = useState<string | null>(null);
    const Icon = ACCOUNT_ICONS.retention;
    const day = (v: string | null) => (v ? formatDay(v, locale) : '');

    return (
        <>
            <Head title={t('accountMenu.retention.title')} />
            <Container className="space-y-8 py-10">
                <header className="flex items-start gap-5">
                    <span
                        aria-hidden
                        className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-maroon text-parchment"
                    >
                        {Icon ? <Icon className="size-6" strokeWidth={1.5} /> : null}
                    </span>
                    <div className="space-y-2">
                        <h1 className="font-display text-[2rem] leading-tight text-ink sm:text-[2.4rem]">
                            {t('accountMenu.retention.title')}
                        </h1>
                        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('retentionPage.intro')}</p>
                    </div>
                </header>
                {flash?.status === 'destroyed' ? (
                    <p role="status" className="flex items-center gap-2 text-sm font-medium text-success">
                        <CircleCheck aria-hidden className="size-4" />
                        {t('retentionPage.destroyed')}
                    </p>
                ) : null}
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('retentionPage.none')}</p>
                ) : (
                    <ul className="space-y-4" data-testid="retention-rows">
                        {rows.map((row) => (
                            <li
                                key={row.id}
                                className="frame-hairline min-w-0 space-y-4 rounded-lg p-5 sm:p-6"
                                data-state={row.state}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="font-semibold break-words text-ink">{row.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {row.organization}
                                            {row.organization ? ', ' : ''}
                                            {t(`statuses.${row.status}`)}
                                        </p>
                                    </div>
                                    <StateChip row={row} />
                                </div>
                                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                                    <div className="min-w-0">
                                        <dt className="text-xs text-muted-foreground">{t('retentionPage.columns.baseline')}</dt>
                                        <dd className="text-charcoal">{day(row.baseline)}</dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-xs text-muted-foreground">{t('retentionPage.columns.end')}</dt>
                                        <dd className="text-charcoal">
                                            {day(row.dueAt)} (
                                            {t('retentionPage.months', {
                                                months: row.months,
                                            })}
                                            )
                                        </dd>
                                    </div>
                                </dl>
                                {row.record ? (
                                    <div className="flex flex-wrap gap-2">
                                        <Button asChild variant="outline" size="sm">
                                            <a href={RetentionController.show.url(row.record.id)} target="_blank" rel="noopener">
                                                <ExternalLink aria-hidden />
                                                {t('retentionPage.minutes')}
                                            </a>
                                        </Button>
                                        <Button asChild variant="outline" size="sm">
                                            <a href={RetentionController.pdf.url(row.record.id)} data-testid="retention-pdf">
                                                <FileDown aria-hidden />
                                                {t('retentionPage.minutesPdf')}
                                            </a>
                                        </Button>
                                    </div>
                                ) : row.canDestroy ? (
                                    open === row.id ? (
                                        <DestroyForm row={row} onCancel={() => setOpen(null)} />
                                    ) : (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setOpen(row.id)}
                                            data-testid="retention-open"
                                        >
                                            {t('retentionPage.destroyAction')}
                                        </Button>
                                    )
                                ) : row.state !== 'active' ? (
                                    <p className="flex items-start gap-2 text-sm text-charcoal">
                                        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                                        {t('retentionPage.archiveFirst')}
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Container>
        </>
    );
}

function StateChip({ row }: { row: Row }) {
    const t = useT();
    const locale = useLocale();
    const label =
        row.state === 'destroyed' && row.record
            ? t('retentionPage.states.destroyed', {
                  date: formatDay(row.record.executedAt, locale),
              })
            : row.state === 'flagged' && row.flaggedAt
              ? t('retentionPage.states.flagged', {
                    date: formatDay(row.flaggedAt, locale),
                })
              : t(`retentionPage.states.${row.state}`);
    return (
        <span
            className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                row.state === 'active' && 'bg-muted text-charcoal',
                (row.state === 'expired' || row.state === 'flagged') && 'bg-gold/15 text-ink',
                row.state === 'destroyed' && 'bg-maroon text-parchment',
            )}
        >
            {label}
        </span>
    );
}

function DestroyForm({ row, onCancel }: { row: Row; onCancel: () => void }) {
    const t = useT();
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
    }).format(new Date());
    const form = useForm({
        ref: '',
        confirmedBy: '',
        confirmedOn: '',
        witness: '',
        notes: '',
        confirm: false,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const id = (name: string) => `destroy-${row.id}-${name}`;

    return (
        <form
            className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:p-5"
            onSubmit={(e) => {
                e.preventDefault();
                form.post(RetentionController.destroy.url(row.id), {
                    preserveScroll: true,
                });
            }}
            data-testid="retention-form"
        >
            <div className="space-y-1">
                <h2 className="text-base font-semibold text-ink">{t('retentionPage.form.title', { name: row.name })}</h2>
                <p className="text-sm leading-relaxed text-charcoal">{t('retentionPage.form.scope')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field id={id('ref')} label={t('retentionPage.form.ref')} error={errors.ref} className="min-w-0">
                    <Input
                        id={id('ref')}
                        required
                        minLength={3}
                        maxLength={200}
                        value={form.data.ref}
                        onChange={(e) => form.setData('ref', e.target.value)}
                    />
                </Field>
                <Field id={id('date')} label={t('retentionPage.form.date')} error={errors.confirmedOn} className="min-w-0">
                    <Input
                        id={id('date')}
                        type="date"
                        required
                        max={today}
                        value={form.data.confirmedOn}
                        onChange={(e) => form.setData('confirmedOn', e.target.value)}
                    />
                </Field>
                <Field id={id('by')} label={t('retentionPage.form.by')} error={errors.confirmedBy} className="min-w-0">
                    <Input
                        id={id('by')}
                        required
                        minLength={3}
                        maxLength={200}
                        value={form.data.confirmedBy}
                        onChange={(e) => form.setData('confirmedBy', e.target.value)}
                    />
                </Field>
                <Field id={id('witness')} label={t('retentionPage.form.witness')} error={errors.witness} className="min-w-0">
                    <Input
                        id={id('witness')}
                        required
                        minLength={3}
                        maxLength={200}
                        value={form.data.witness}
                        onChange={(e) => form.setData('witness', e.target.value)}
                    />
                </Field>
            </div>
            <Field id={id('notes')} label={t('retentionPage.form.notes')} error={errors.notes}>
                <TextArea
                    id={id('notes')}
                    rows={2}
                    maxLength={2000}
                    value={form.data.notes}
                    onChange={(e) => form.setData('notes', e.target.value)}
                />
            </Field>
            <label className="flex items-start gap-3 text-sm text-ink">
                <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-maroon"
                    checked={form.data.confirm}
                    onChange={(e) => form.setData('confirm', e.target.checked)}
                    data-testid="retention-confirm"
                />
                {t('retentionPage.form.confirm')}
            </label>
            <FormError message={errors.confirm ?? errors.form} />
            <div className="flex flex-wrap gap-2">
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={form.processing || !form.data.confirm}
                    data-testid="retention-submit"
                >
                    {t('retentionPage.form.submit')}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    {t('retentionPage.form.cancel')}
                </Button>
            </div>
        </form>
    );
}
