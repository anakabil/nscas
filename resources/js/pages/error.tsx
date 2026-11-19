import { Head } from '@inertiajs/react';
import { NscasMark } from '@/components/brand/nscas-mark';
import { useT } from '@/i18n';

// Halaman galat (403, 404, 429, 500, 503). Tautan kembali berupa elemen a biasa: halaman ini juga tampil untuk
// pengunjung yang belum masuk, dan beranda akan mengarahkan mereka ke halaman masuk.
export default function ErrorPage({ status }: { status: number }) {
    const t = useT();
    const code = [403, 404, 419, 429, 500, 503].includes(status) ? status : 500;
    return (
        <>
            <Head title={t(`errors.${code}.title`)} />
            <main className="bg-obsidian-dial flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center text-white">
                <NscasMark detailed className="w-28" />
                <p className="mt-8 font-display text-6xl font-semibold text-silver tabular-nums">{status}</p>
                <h1 className="mt-4 font-display text-3xl font-semibold">{t(`errors.${code}.title`)}</h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">{t(`errors.${code}.body`)}</p>
                <div className="hairline-gold my-8 w-40" />
                <a
                    href="/"
                    className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-obsidian hover:bg-silver-bright"
                >
                    {t('errors.back')}
                </a>
            </main>
        </>
    );
}
