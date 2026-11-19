import { Head, Link, usePage } from '@inertiajs/react';
import { Check, Circle, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { MODULE_ICONS } from '@/components/icons/module-icons';
import { AssessmentHeader } from '@/components/nscas/assessment-header';
import { Container } from '@/components/nscas/parts';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { AssessmentMenu } from '@/types/nscas';

export type PlanningItem = { key: string; done: boolean; href: string };

/** Bagian bersama setiap halaman tahap 1 yang dikirim SetupController::common(). */
export type SetupCommon = {
    assessment: AssessmentMenu;
    planning: PlanningItem[];
    locked: boolean;
    lockedAt: string | null;
    closed: boolean;
    canEdit: boolean;
};

/** Waktu lengkap, misalnya "19 November 2026 14.05". */
export function formatDateTime(value: string, locale: 'id' | 'en'): string {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

/** Angka dengan format Indonesia: koma desimal, titik ribuan. */
export function formatNumber(value: number, locale: 'id' | 'en', digits = 0): string {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

/**
 * Kerangka halaman tahap 1 (perencanaan): kepala asesmen, navigasi tujuh halaman dengan tanda kelengkapan, judul
 * modul, pemberitahuan kunci atau baca saja, dan pesan simpan.
 */
export function SetupShell({ module, common, children }: { module: string; common: SetupCommon; children: ReactNode }) {
    const t = useT();
    const locale = useLocale();
    const { flash } = usePage<{ flash?: { status?: string | null } }>().props;
    const Icon = MODULE_ICONS[module];
    const title = t(`modules.${module}.title`);
    const done = common.planning.filter((item) => item.done).length;

    const notice = common.closed
        ? t('shell.closed')
        : common.locked && module !== 'units' && module !== 'team'
          ? common.lockedAt
              ? t('shell.locked', { time: formatDateTime(common.lockedAt, locale) })
              : t('shell.lockedNoTime')
          : !common.canEdit
            ? t('shell.readOnly')
            : null;

    return (
        <>
            <Head title={`${title} · ${common.assessment.name}`} />
            <AssessmentHeader
                assessment={common.assessment}
                back={{ href: common.assessment.href, label: t('shell.backToHub') }}
            />
            <Container className="grid gap-10 py-10 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
                <nav aria-label={t('shell.navTitle')} className="lg:sticky lg:top-6 lg:self-start" data-testid="setup-nav">
                    <p className="eyebrow text-gold-deep">{t('shell.navTitle')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {t('shell.progress', { done, total: common.planning.length })}
                    </p>
                    <ol className="mt-4 space-y-1">
                        {common.planning.map((item) => {
                            const active = item.key === module;
                            return (
                                <li key={item.key}>
                                    <Link
                                        href={item.href}
                                        aria-current={active ? 'page' : undefined}
                                        className={cn(
                                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                                            active ? 'bg-maroon text-parchment' : 'text-foreground hover:bg-muted',
                                        )}
                                    >
                                        {item.done ? (
                                            <Check
                                                aria-label={t('shell.done')}
                                                className={cn('size-4 shrink-0', active ? 'text-gold-soft' : 'text-success')}
                                            />
                                        ) : (
                                            <Circle
                                                aria-label={t('shell.pending')}
                                                className={cn('size-4 shrink-0', active ? 'text-parchment/70' : 'text-taupe-dim')}
                                            />
                                        )}
                                        <span className="truncate">{t(`modules.${item.key}.title`)}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                </nav>
                <main className="min-w-0 space-y-8" data-testid="setup-page" data-module={module}>
                    <header className="flex items-start gap-5">
                        <span
                            aria-hidden
                            className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-maroon text-parchment"
                        >
                            {Icon ? <Icon className="size-6" strokeWidth={1.5} /> : null}
                        </span>
                        <div className="space-y-1.5">
                            <p className="eyebrow text-gold-deep">
                                {t('module.stageLabel', { number: 1, stage: t('stages.PLANNING.title') })}
                            </p>
                            <h2 className="font-display text-[1.9rem] leading-tight text-ink">{title}</h2>
                        </div>
                    </header>
                    {notice ? (
                        <p
                            role="note"
                            className="flex items-start gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground"
                        >
                            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                            {notice}
                        </p>
                    ) : null}
                    {flash?.status && ['saved', 'created', 'transitioned'].includes(flash.status) ? (
                        <p
                            role="status"
                            className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
                        >
                            {t(`flash.${flash.status}`)}
                        </p>
                    ) : null}
                    {children}
                </main>
            </Container>
        </>
    );
}

/** Kartu bagian isi halaman dengan judul dan penjelasan singkat. */
export function Panel({
    title,
    hint,
    children,
    className,
}: {
    title?: string;
    hint?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('frame-hairline space-y-5 rounded-lg p-6 sm:p-7', className)}>
            {title ? (
                <div className="space-y-1">
                    <h3 className="text-base font-semibold text-ink">{title}</h3>
                    {hint ? <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

/** Label, isian, petunjuk, dan pesan galat dalam satu kelompok. */
export function Field({
    id,
    label,
    hint,
    error,
    children,
    className,
}: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('grid gap-1.5', className)}>
            <label htmlFor={id} className="text-sm font-medium text-foreground">
                {label}
            </label>
            {children}
            {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

/** Pilihan bawaan peramban dengan gaya yang sama dengan isian teks. */
export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            {...props}
            className={cn(
                'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
                className,
            )}
        />
    );
}

/** Isian teks panjang dengan gaya yang sama dengan isian teks. */
export function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            className={cn(
                'min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
                className,
            )}
        />
    );
}

/** Pesan galat umum formulir (isian "form"), misalnya pelanggaran aturan dari layanan. */
export function FormError({ message }: { message?: string }) {
    return message ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {message}
        </p>
    ) : null;
}
