import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { Container } from '@/components/nscas/parts';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export default function SettingsLayout({ children }: PropsWithChildren) {
    const t = useT();
    const path = usePage().url.split('?')[0];
    const items = [
        { href: '/settings/profile', label: t('settingsNav.profile') },
        { href: '/settings/security', label: t('settingsNav.security') },
    ];

    return (
        <Container className="py-10">
            <header className="space-y-2">
                <h1 className="font-display text-3xl font-semibold text-obsidian">{t('settingsNav.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('settingsNav.description')}</p>
            </header>
            <div className="hairline-silver my-6" />
            <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
                <nav aria-label={t('settingsNav.title')} className="flex gap-1 lg:w-48 lg:flex-col">
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={path === item.href ? 'page' : undefined}
                            className={cn(
                                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                path === item.href ? 'bg-obsidian text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <section className="max-w-xl flex-1 space-y-12 rounded-xl border border-border bg-card p-6 sm:p-8">{children}</section>
            </div>
        </Container>
    );
}
