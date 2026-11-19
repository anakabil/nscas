import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { Container, StageMeter } from '@/components/nscas/parts';
import { formatDate, useLocale, useT } from '@/i18n';
import type { AssessmentMenu } from '@/types/nscas';

/** Kepala halaman asesmen: organisasi, nama, status, tahap, periode, dan penanda enam tahap. */
export function AssessmentHeader({ assessment, back }: { assessment: AssessmentMenu; back: { href: string; label: string } }) {
    const t = useT();
    const locale = useLocale();
    return (
        <section className="bg-obsidian-dial text-white">
            <Container className="space-y-7 py-12">
                <Link
                    href={back.href}
                    className="inline-flex items-center gap-2 text-sm font-medium text-white/65 hover:text-white"
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    {back.label}
                </Link>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <p className="eyebrow flex items-center gap-3 text-gold">
                            <span aria-hidden className="h-px w-10 bg-gold/80" />
                            {assessment.organization}
                        </p>
                        <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-5xl">{assessment.name}</h1>
                        <p className="numeral text-sm text-white/65">
                            {t('assessments.periodRange', {
                                start: formatDate(assessment.periodStart, locale),
                                end: formatDate(assessment.periodEnd, locale),
                            })}
                            {' · '}
                            {t('assessments.targetLevel', { level: assessment.targetLevel })}
                        </p>
                    </div>
                    <div className="w-full space-y-2.5 lg:w-80" data-testid="assessment-stage">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="numeral font-semibold text-gold-soft">
                                {assessment.stage ? t('home.stageLine', { number: assessment.stage }) : t('home.closedLine')}
                            </span>
                            <span className="text-white/60" data-status={assessment.status}>
                                {t(`statuses.${assessment.status}`)}
                            </span>
                        </div>
                        <StageMeter stages={assessment.stages} />
                    </div>
                </div>
            </Container>
        </section>
    );
}
