import { Head } from '@inertiajs/react';
import { CircleCheck, CircleX } from 'lucide-react';
import { Container } from '@/components/nscas/parts';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Check = { key: 'database' | 'queue' | 'storage'; ok: boolean };

export default function SystemStatus({ checks, checkedAt }: { checks: Check[]; checkedAt: string }) {
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
            </Container>
        </>
    );
}
