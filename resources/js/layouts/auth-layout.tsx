import { router } from '@inertiajs/react';
import { Languages } from 'lucide-react';
import { NscasLockup } from '@/components/brand/nscas-mark';
import { useLocale, useT } from '@/i18n';

// Halaman masuk dan verifikasi: panel identitas hitam di kiri (layar lebar), formulir di kanan.
// Panel memakai pola lingkar ukur dari CSS dan logo dial berukuran besar; tidak ada berkas gambar.

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
}) {
    const t = useT();
    const locale = useLocale();
    const other = locale === 'id' ? 'en' : 'id';

    return (
        <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <aside className="bg-maroon-dial relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
                <span aria-hidden />
                <div className="relative max-w-md space-y-10">
                    <NscasLockup label={t('app.name')} tone="reversed" tagline className="w-full max-w-[24rem]" />
                    <div className="rule-ornament w-48 opacity-90" />
                    <p className="font-display text-[2.35rem] leading-[1.12] text-cream">{t('app.tagline')}</p>
                </div>
                <p className="text-xs text-cream/60">{t('app.owner')}</p>
            </aside>
            <main className="flex flex-col bg-background">
                <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3 lg:border-0 lg:bg-transparent lg:px-10 lg:pt-8">
                    <NscasLockup label={t('app.name')} className="h-10 w-auto lg:hidden" />
                    <button
                        type="button"
                        onClick={() => router.post('/locale', { locale: other }, { preserveScroll: true })}
                        lang={other}
                        className="ml-auto flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                        <Languages aria-hidden className="size-4" strokeWidth={1.5} />
                        {t('nav.switchTo')}
                    </button>
                </div>
                <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10">
                    <div className="mx-auto w-full max-w-md">
                        <div className="frame-hairline rounded-lg p-7 shadow-[0_30px_70px_-45px_rgb(26_26_26/0.5)] sm:p-10">
                            {title ? (
                                <div className="mb-7 space-y-2">
                                    <h1 className="font-display text-[2rem] leading-[1.12] text-ink">{title}</h1>
                                    {description ? (
                                        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                                    ) : null}
                                </div>
                            ) : null}
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
