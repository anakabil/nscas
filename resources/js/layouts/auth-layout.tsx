import { router } from '@inertiajs/react';
import { Languages } from 'lucide-react';
import { NscasLockup, NscasMark } from '@/components/brand/nscas-mark';
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
            <aside className="bg-obsidian-dial relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
                <NscasLockup name={t('app.name')} byline={t('app.byline')} size="md" />
                <div className="relative max-w-md space-y-6">
                    <NscasMark detailed className="w-40 opacity-95" />
                    <div className="space-y-4">
                        <p className="eyebrow text-gold">{t('app.fullName')}</p>
                        <p className="font-display text-3xl leading-snug font-medium text-white">{t('app.tagline')}</p>
                    </div>
                    <div className="hairline-gold w-40" />
                </div>
                <p className="text-xs text-white/55">{t('app.owner')}</p>
            </aside>
            <main className="flex flex-col bg-background">
                <div className="flex items-center justify-between bg-obsidian px-5 py-4 text-white lg:bg-transparent lg:px-10 lg:pt-8 lg:text-foreground">
                    <NscasLockup name={t('app.name')} byline={t('app.byline')} size="sm" className="lg:hidden" />
                    <button
                        type="button"
                        onClick={() => router.post('/locale', { locale: other }, { preserveScroll: true })}
                        lang={other}
                        className="ml-auto flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-white/75 hover:text-white lg:text-muted-foreground lg:hover:text-foreground"
                    >
                        <Languages aria-hidden className="size-4" strokeWidth={1.5} />
                        {t('nav.switchTo')}
                    </button>
                </div>
                <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10">
                    <div className="mx-auto w-full max-w-md">
                        <div className="frame-silver rounded-2xl p-7 shadow-[0_24px_60px_-40px_rgb(17_17_19/0.45)] sm:p-9">
                            {title ? (
                                <div className="mb-7 space-y-2">
                                    <h1 className="font-display text-[1.7rem] leading-tight font-semibold text-obsidian">{title}</h1>
                                    {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
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
