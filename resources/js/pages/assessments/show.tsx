import { Head } from '@inertiajs/react';
import { Circle } from 'lucide-react';
import { AssessmentHeader } from '@/components/nscas/assessment-header';
import { Container, SectionHeading, StageCard, TaskTile } from '@/components/nscas/parts';
import { useT } from '@/i18n';
import type { AssessmentMenu } from '@/types/nscas';

// Pusat asesmen: menu enam tahap, syarat menuju status berikutnya, dan halaman lintas tahap.
export default function AssessmentShow({ assessment }: { assessment: AssessmentMenu }) {
    const t = useT();
    return (
        <>
            <Head title={assessment.name} />
            <AssessmentHeader assessment={assessment} back={{ href: '/home', label: t('hub.backToHome') }} />
            <Container className="space-y-14 py-12">
                <section className="frame-silver rounded-xl p-6 sm:p-8" data-testid="next-step">
                    {assessment.next ? (
                        <div className="space-y-4">
                            <h2 className="font-display text-xl font-semibold text-obsidian">
                                {t('hub.nextTitle', { status: t(`statuses.${assessment.next.to}`) })}
                            </h2>
                            <ul className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                                {assessment.next.conditions.map((condition) => (
                                    <li key={condition} className="flex items-start gap-2.5">
                                        <Circle
                                            aria-hidden
                                            className="mt-0.5 size-4 shrink-0 text-silver-dim"
                                            strokeWidth={1.5}
                                        />
                                        <span>{t(`conditions.${condition}`)}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                {t('hub.nextActor', { role: t(`roles.${assessment.next.actor}.name`) })} {t('hub.nextPending')}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('hub.noNext')}</p>
                    )}
                </section>

                <section className="space-y-6" data-testid="menu-by-stage">
                    <SectionHeading
                        eyebrow={t('hub.progressTitle')}
                        title={t('home.byStageTitle')}
                        intro={t('home.byStageIntro')}
                    />
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {assessment.stages.map((stage) => (
                            <StageCard key={stage.key} stage={stage} />
                        ))}
                    </div>
                </section>

                {assessment.crossStage.length > 0 ? (
                    <section className="space-y-6">
                        <SectionHeading title={t('hub.crossStageTitle')} />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {assessment.crossStage.map((module) => (
                                <TaskTile key={module.key} module={module} />
                            ))}
                        </div>
                    </section>
                ) : null}
            </Container>
        </>
    );
}
