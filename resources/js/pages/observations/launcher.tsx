import { Head, Link } from '@inertiajs/react';
import { Camera } from 'lucide-react';
import { NscasLockup } from '@/components/brand/nscas-mark';
import { formatWib } from '@/components/nscas/collection-shell';
import { InstallableApp } from '@/components/nscas/installable-app';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/i18n';

type Item = {
    id: string;
    title: string;
    unit: string | null;
    assessment: string;
    organization: string | null;
    closesAt: string;
    href: string;
};

/** Pintu masuk aplikasi kamera observasi: masa observasi yang sedang terbuka untuk pengguna ini. */
export default function ObservationLauncher({ windows }: { windows: Item[] }) {
    const t = useT();
    const locale = useLocale();

    return (
        <>
            <Head title={t('observeLauncher.title')} />
            <InstallableApp />
            <main
                className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 bg-background px-4 py-6"
                data-testid="observe-launcher"
            >
                <header className="flex items-center justify-between gap-4">
                    <NscasLockup label="NSCAS" className="w-28" />
                    <Link href="/home" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                        {t('observeLauncher.home')}
                    </Link>
                </header>
                <div className="space-y-1.5">
                    <h1 className="font-display text-[1.75rem] leading-tight text-ink">{t('observeLauncher.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('observeLauncher.intro')}</p>
                </div>
                {windows.length === 0 ? (
                    <p className="rounded-lg border border-border p-5 text-sm text-charcoal" data-testid="observe-launcher-empty">
                        {t('observeLauncher.empty')}
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {windows.map((w) => (
                            <li key={w.id} className="frame-hairline min-w-0 space-y-3 rounded-lg p-4">
                                <div className="min-w-0 space-y-0.5">
                                    <p className="font-semibold break-words text-ink">{w.title}</p>
                                    <p className="text-sm break-words text-charcoal">
                                        {[w.unit, w.assessment].filter(Boolean).join(', ')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('observeLauncher.closes', { time: formatWib(w.closesAt, locale) })}
                                    </p>
                                </div>
                                <Button asChild className="w-full">
                                    <Link href={w.href}>
                                        <Camera aria-hidden />
                                        {t('observeLauncher.open')}
                                    </Link>
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </>
    );
}
