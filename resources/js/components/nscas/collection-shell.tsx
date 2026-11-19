import { Head, Link, usePage } from '@inertiajs/react';
import { CalendarClock, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { MODULE_ICONS } from '@/components/icons/module-icons';
import { AssessmentHeader } from '@/components/nscas/assessment-header';
import { Container } from '@/components/nscas/parts';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { AssessmentMenu } from '@/types/nscas';

/** Bagian bersama halaman tahap 2 fase R2 yang dikirim CollectionController::collectionCommon(). */
export type CollectionCommon = {
    assessment: AssessmentMenu;
    tabs: { key: string; href: string }[];
    distribution: 'notYet' | 'open' | 'closed';
    window: { opensAt: string | null; closesAt: string | null; open: boolean };
};

/** Persentase dengan format bahasa halaman, misalnya "42,5 persen". */
export function formatPercent(value: number, locale: 'id' | 'en', digits = 1): string {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        style: 'percent',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

/** Waktu dalam WIB, misalnya "1 Desember 2026 08.00", tanpa bergantung pada zona waktu peramban. */
export function formatWib(value: string, locale: 'id' | 'en'): string {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
}

/**
 * Kerangka halaman responden, kode QR, dan partisipasi: kepala asesmen, tab ketiga halaman, keadaan distribusi dan
 * jendela survei, serta pesan simpan.
 */
export function CollectionShell({
    module,
    common,
    canEdit,
    children,
}: {
    module: string;
    common: CollectionCommon;
    canEdit: boolean;
    children: ReactNode;
}) {
    const t = useT();
    const locale = useLocale();
    const { flash } = usePage<{ flash?: { status?: string | null } }>().props;
    const Icon = MODULE_ICONS[module];
    const title = t(`modules.${module}.title`);
    const notice =
        common.distribution === 'notYet'
            ? t('collection.notYet')
            : common.distribution === 'closed'
              ? t('collection.closed')
              : !canEdit
                ? t('collection.readOnly')
                : null;
    const survey = common.window;

    return (
        <>
            <Head title={`${title} · ${common.assessment.name}`} />
            <AssessmentHeader
                assessment={common.assessment}
                back={{ href: common.assessment.href, label: t('shell.backToHub') }}
            />
            <Container className="py-10">
                <div className="space-y-8" data-testid="collection-page" data-module={module}>
                    <nav aria-label={t('collection.navTitle')} className="flex flex-wrap gap-2 border-b border-border pb-4">
                        {common.tabs.map((tab) => (
                            <Link
                                key={tab.key}
                                href={tab.href}
                                aria-current={tab.key === module ? 'page' : undefined}
                                className={cn(
                                    'rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                                    tab.key === module ? 'bg-maroon text-parchment' : 'text-foreground hover:bg-muted',
                                )}
                            >
                                {t(`modules.${tab.key}.title`)}
                            </Link>
                        ))}
                    </nav>
                    <header className="flex items-start gap-5">
                        <span
                            aria-hidden
                            className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-maroon text-parchment"
                        >
                            {Icon ? <Icon className="size-6" strokeWidth={1.5} /> : null}
                        </span>
                        <div className="space-y-1.5">
                            <p className="eyebrow text-gold-deep">{t('collection.stage')}</p>
                            <h2 className="font-display text-[1.9rem] leading-tight text-ink">{title}</h2>
                        </div>
                    </header>
                    <p className="flex items-start gap-3 text-sm text-charcoal" data-testid="survey-window">
                        <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                        <span>
                            {survey.opensAt && survey.closesAt
                                ? t('collection.windowRange', {
                                      opens: formatWib(survey.opensAt, locale),
                                      closes: formatWib(survey.closesAt, locale),
                                  })
                                : t('collection.windowUnset')}{' '}
                            <strong className={survey.open ? 'text-success' : 'text-charcoal'}>
                                {survey.open ? t('collection.windowOpen') : t('collection.windowClosed')}
                            </strong>
                        </span>
                    </p>
                    {notice ? (
                        <p
                            role="note"
                            className="flex items-start gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground"
                        >
                            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                            {notice}
                        </p>
                    ) : null}
                    {flash?.status === 'saved' ? (
                        <p
                            role="status"
                            className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
                        >
                            {t('flash.saved')}
                        </p>
                    ) : null}
                    {children}
                </div>
            </Container>
        </>
    );
}
