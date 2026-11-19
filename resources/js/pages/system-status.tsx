import { Head } from '@inertiajs/react';
import { CircleCheck, CircleX } from 'lucide-react';
import { actionLabel } from '@/components/nscas/audit-labels';
import { formatWib } from '@/components/nscas/collection-shell';
import { Container } from '@/components/nscas/parts';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Check = { key: 'database' | 'queue' | 'storage'; ok: boolean };
type Access = {
    id: number;
    at: string;
    action: string;
    name: string | null;
    email: string | null;
};

export default function SystemStatus({ checks, checkedAt, access }: { checks: Check[]; checkedAt: string; access: Access[] }) {
    const t = useT();
    const locale = useLocale();
    const time = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
    }).format(new Date(checkedAt));
    return (
        <>
            <Head title={t('systemStatus.title')} />
            <Container className="space-y-8 py-10">
                <header className="space-y-2">
                    <h1 className="font-display text-[2.25rem] leading-tight text-ink sm:text-[2.6rem]">
                        {t('systemStatus.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t('systemStatus.intro')}</p>
                </header>
                <ul className="grid gap-4 sm:grid-cols-3">
                    {checks.map((check) => (
                        <li
                            key={check.key}
                            className="frame-hairline rounded-lg p-6"
                            data-testid={`status-${check.key}`}
                            data-ok={check.ok}
                        >
                            <p className="text-sm text-muted-foreground">{t(`systemStatus.${check.key}`)}</p>
                            <p
                                className={cn(
                                    'mt-2 flex items-center gap-2 text-lg font-semibold',
                                    check.ok ? 'text-success' : 'text-destructive',
                                )}
                            >
                                {check.ok ? (
                                    <CircleCheck aria-hidden className="size-5" />
                                ) : (
                                    <CircleX aria-hidden className="size-5" />
                                )}
                                {t(check.ok ? 'systemStatus.ok' : 'systemStatus.fail')}
                            </p>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-muted-foreground">{t('systemStatus.checkedAt', { time })}</p>
                <section className="space-y-3" data-testid="access-log">
                    <div className="space-y-1">
                        <h2 className="text-base font-semibold text-ink">{t('accessLog.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('accessLog.intro')}</p>
                    </div>
                    {access.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('accessLog.empty')}</p>
                    ) : (
                        <ol className="divide-y divide-border rounded-lg border border-border">
                            {access.map((a) => (
                                <li
                                    key={a.id}
                                    className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm"
                                >
                                    <span className="min-w-0">
                                        <span className="font-medium text-ink">{actionLabel(t, a.action)}</span>
                                        <span className="break-all text-charcoal">
                                            , {a.name ?? a.email ?? t('accessLog.unknown')}
                                        </span>
                                    </span>
                                    <time className="text-xs text-muted-foreground tabular-nums" dateTime={a.at}>
                                        {formatWib(a.at, locale)}
                                    </time>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </Container>
        </>
    );
}
