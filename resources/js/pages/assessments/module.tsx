import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { MODULE_ICONS } from '@/components/icons/module-icons';
import { AssessmentHeader } from '@/components/nscas/assessment-header';
import { Container, PhaseTag } from '@/components/nscas/parts';
import { useT } from '@/i18n';
import type { AssessmentMenu } from '@/types/nscas';

type Props = {
    assessment: AssessmentMenu;
    module: { key: string; stage: number | null; ready: boolean; buildPhase: string };
};

// Halaman kerja satu modul. Selama rombak v2, modul yang belum dibangun menampilkan isi dan fasenya.
export default function AssessmentModule({ assessment, module }: Props) {
    const t = useT();
    const Icon = MODULE_ICONS[module.key];
    const stage = assessment.stages.find((group) => group.number === module.stage);
    const title = t(`modules.${module.key}.title`);
    return (
        <>
            <Head title={`${title} · ${assessment.name}`} />
            <AssessmentHeader assessment={assessment} back={{ href: assessment.href, label: t('module.backToHub') }} />
            <Container className="py-12">
                <article
                    className="frame-silver mx-auto max-w-2xl rounded-2xl p-8 sm:p-10"
                    data-testid="module-page"
                    data-module={module.key}
                >
                    <div className="flex items-start gap-5">
                        <span
                            aria-hidden
                            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-obsidian text-silver-bright"
                        >
                            {Icon ? <Icon className="size-6" strokeWidth={1.5} /> : null}
                        </span>
                        <div className="space-y-2">
                            <p className="eyebrow text-gold-deep">
                                {stage
                                    ? t('module.stageLabel', { number: stage.number, stage: t(`stages.${stage.key}.title`) })
                                    : t('module.crossStageLabel')}
                            </p>
                            <h2 className="font-display text-2xl font-semibold text-obsidian">{title}</h2>
                            <p className="text-sm text-muted-foreground">{t(`modules.${module.key}.hint`)}</p>
                        </div>
                    </div>
                    <div className="hairline-silver my-7" />
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-semibold text-foreground">{t('module.pendingTitle')}</h3>
                            <PhaseTag phase={module.buildPhase} />
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {t('module.pendingBody', { module: title, phase: module.buildPhase })}
                        </p>
                    </div>
                    <Link
                        href={assessment.href}
                        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-obsidian hover:underline"
                    >
                        <ArrowLeft aria-hidden className="size-4" />
                        {t('module.backToHub')}
                    </Link>
                </article>
            </Container>
        </>
    );
}
