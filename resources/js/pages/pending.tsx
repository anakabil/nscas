import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { ACCOUNT_ICONS } from '@/components/icons/module-icons';
import { Container, PhaseTag } from '@/components/nscas/parts';
import { useT } from '@/i18n';

// Area tingkat akun yang belum dibangun ulang (organisasi dan pengguna, asesmen baru, retensi data).
export default function Pending({ area, buildPhase }: { area: string; buildPhase: string }) {
    const t = useT();
    const Icon = ACCOUNT_ICONS[area];
    const title = t(`accountMenu.${area}.title`);
    return (
        <>
            <Head title={title} />
            <Container className="py-14">
                <article
                    className="frame-silver mx-auto max-w-2xl rounded-lg p-8 sm:p-10"
                    data-testid="pending-page"
                    data-area={area}
                >
                    <div className="flex items-start gap-5">
                        <span
                            aria-hidden
                            className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-obsidian text-silver-bright"
                        >
                            {Icon ? <Icon className="size-6" strokeWidth={1.5} /> : null}
                        </span>
                        <div className="space-y-2">
                            <h1 className="font-display text-[1.85rem] leading-tight text-obsidian">{title}</h1>
                            <p className="text-sm text-muted-foreground">{t(`accountMenu.${area}.hint`)}</p>
                        </div>
                    </div>
                    <div className="hairline-silver my-7" />
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-semibold">{t('pending.title')}</h2>
                        <PhaseTag phase={buildPhase} />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {t('pending.body', { area: title, phase: buildPhase })}
                    </p>
                    <Link
                        href="/home"
                        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-obsidian hover:underline"
                    >
                        <ArrowLeft aria-hidden className="size-4" />
                        {t('pending.back')}
                    </Link>
                </article>
            </Container>
        </>
    );
}
