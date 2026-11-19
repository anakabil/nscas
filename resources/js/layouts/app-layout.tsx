import { Link, router, usePage } from '@inertiajs/react';
import { ChevronDown, ClipboardList, House, Languages, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { NscasLockup } from '@/components/brand/nscas-mark';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { User } from '@/types/auth';

// Bingkai halaman kerja: kepala halaman hitam dengan logo, navigasi utama, bahasa, dan menu pengguna.
// Menu lipat memakai elemen details agar tetap berfungsi tanpa skrip dan ramah pembaca layar.

function switchLocale(locale: 'id' | 'en') {
    router.post('/locale', { locale }, { preserveScroll: true });
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const t = useT();
    const locale = useLocale();
    const page = usePage<{ auth: { user: User | null } }>();
    const user = page.props.auth.user;
    const path = page.url.split('?')[0];
    const items = [
        { href: '/home', label: t('nav.home'), icon: House, active: path === '/home' },
        { href: '/assessments', label: t('nav.assessments'), icon: ClipboardList, active: path.startsWith('/assessments') },
    ];
    const other = locale === 'id' ? 'en' : 'id';

    return (
        <div className="flex min-h-screen flex-col">
            <a
                href="#content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-obsidian"
            >
                {t('app.skipToContent')}
            </a>
            <header className="bg-obsidian text-white">
                <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
                    <Link href="/home" className="shrink-0" aria-label={`${t('app.name')}, ${t('nav.home')}`}>
                        <NscasLockup name={t('app.name')} byline={t('app.byline')} size="sm" />
                    </Link>
                    <nav aria-label={t('nav.main')} className="hidden items-center gap-1 md:flex">
                        {items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={item.active ? 'page' : undefined}
                                className={cn(
                                    'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                    item.active ? 'text-white' : 'text-white/65 hover:text-white',
                                )}
                            >
                                <item.icon aria-hidden className="size-4" strokeWidth={1.5} />
                                {item.label}
                                {item.active ? <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-px bg-gold" /> : null}
                            </Link>
                        ))}
                    </nav>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => switchLocale(other)}
                            lang={other}
                            className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/65 transition-colors hover:text-white sm:flex"
                        >
                            <Languages aria-hidden className="size-4" strokeWidth={1.5} />
                            {t('nav.switchTo')}
                        </button>
                        {user ? (
                            <details className="group relative">
                                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-white/35 [&::-webkit-details-marker]:hidden">
                                    <Menu aria-hidden className="size-4 md:hidden" strokeWidth={1.5} />
                                    <span className="hidden max-w-[11rem] truncate md:inline">{user.name}</span>
                                    <span className="md:hidden">{t('nav.menu')}</span>
                                    <ChevronDown aria-hidden className="size-4 text-white/60 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-border bg-card p-2 text-card-foreground shadow-xl">
                                    <p className="px-3 pt-2 pb-3 text-xs text-muted-foreground">{t('nav.signedInAs', { name: user.name })}</p>
                                    <nav aria-label={t('nav.menu')} className="flex flex-col md:hidden">
                                        {items.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                aria-current={item.active ? 'page' : undefined}
                                                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                                            >
                                                <item.icon aria-hidden className="size-4 text-silver-dim" strokeWidth={1.5} />
                                                {item.label}
                                            </Link>
                                        ))}
                                    </nav>
                                    <Link href="/settings/profile" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                                        <ShieldCheck aria-hidden className="size-4 text-silver-dim" strokeWidth={1.5} />
                                        {t('nav.account')}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => switchLocale(other)}
                                        lang={other}
                                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted sm:hidden"
                                    >
                                        <Languages aria-hidden className="size-4 text-silver-dim" strokeWidth={1.5} />
                                        {t('nav.switchTo')}
                                    </button>
                                    <div className="my-2 h-px bg-border" />
                                    <Link
                                        href="/logout"
                                        method="post"
                                        as="button"
                                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                                    >
                                        <LogOut aria-hidden className="size-4 text-silver-dim" strokeWidth={1.5} />
                                        {t('nav.logout')}
                                    </Link>
                                </div>
                            </details>
                        ) : null}
                    </div>
                </div>
                <div className="hairline-gold opacity-60" />
            </header>
            <main id="content" className="flex-1">
                {children}
            </main>
            <footer className="border-t border-border bg-card">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-muted-foreground sm:px-6 lg:px-8">
                    <p>{t('app.notCertification')}</p>
                    <p>{t('app.owner')}</p>
                </div>
            </footer>
        </div>
    );
}
