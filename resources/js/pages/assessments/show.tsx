import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, Circle, CircleDashed } from 'lucide-react';
import AssessmentTransitionController from '@/actions/App/Http/Controllers/AssessmentTransitionController';
import { AssessmentHeader } from '@/components/nscas/assessment-header';
import { Container, SectionHeading, StageCard, TaskTile } from '@/components/nscas/parts';
import { FormError } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/i18n';
import type { AssessmentMenu, AssessmentProgress, ConditionCheck } from '@/types/nscas';

function ConditionIcon({ met }: { met: boolean | null }) {
    const t = useT();
    if (met === true) {
        return <CheckCircle2 aria-label={t('transition.met')} className="mt-0.5 size-4 shrink-0 text-success" />;
    }
    if (met === false) {
        return <Circle aria-label={t('transition.unmet')} className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.75} />;
    }
    return (
        <CircleDashed aria-label={t('transition.unknown')} className="mt-0.5 size-4 shrink-0 text-taupe-dim" strokeWidth={1.5} />
    );
}

function ConditionRow({ condition }: { condition: ConditionCheck }) {
    const t = useT();
    return (
        <li className="flex items-start gap-2.5" data-condition={condition.key} data-met={String(condition.met)}>
            <ConditionIcon met={condition.met} />
            <span className="min-w-0">
                <span className={condition.met === true ? 'text-muted-foreground' : 'text-foreground'}>
                    {t(`conditions.${condition.key}`)}
                </span>
                {condition.met === null ? (
                    <span className="block text-xs text-muted-foreground">{t('transition.unknown')}</span>
                ) : null}
                {condition.met === false && condition.href ? (
                    <Link
                        href={condition.href}
                        className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-maroon hover:underline"
                    >
                        {t('transition.open')}
                        <ArrowRight aria-hidden className="size-3" />
                    </Link>
                ) : null}
            </span>
        </li>
    );
}

// Pusat asesmen: syarat menuju status berikutnya beserta tombol ubah status, menu enam tahap, dan halaman lintas tahap.
export default function AssessmentShow({ assessment, progress }: { assessment: AssessmentMenu; progress: AssessmentProgress }) {
    const t = useT();
    const locale = useLocale();
    const next = progress.next;
    const form = useForm({ to: next?.to ?? '' });
    const { flash } = usePage<{ flash?: { status?: string | null } }>().props;
    const transition = () => {
        const warning = next?.to === 'LOCKED' ? `${t('transition.lockWarning')}\n\n` : '';
        if (next && window.confirm(`${warning}${t('transition.moveTo', { status: t(`statuses.${next.to}`) })}?`)) {
            // Status tujuan selalu diambil dari data terbaru, bukan dari status formulir saat halaman pertama dibuka.
            form.transform(() => ({ to: next.to }));
            form.post(AssessmentTransitionController.url(assessment.id), { preserveScroll: true });
        }
    };
    return (
        <>
            <Head title={assessment.name} />
            <AssessmentHeader assessment={assessment} back={{ href: '/home', label: t('hub.backToHome') }} />
            <Container className="space-y-14 py-12">
                <section className="frame-hairline rounded-lg p-7 sm:p-9" data-testid="next-step">
                    {next ? (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-baseline justify-between gap-3">
                                <h2 className="font-display text-[1.5rem] leading-tight text-ink">
                                    {t('hub.nextTitle', { status: t(`statuses.${next.to}`) })}
                                </h2>
                                <span className="numeral text-sm font-semibold text-gold-deep">
                                    {t('dashboard.readiness', { met: progress.readiness.met, total: progress.readiness.total })}
                                </span>
                            </div>
                            {flash?.status === 'transitioned' ? (
                                <p
                                    role="status"
                                    className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
                                >
                                    {t('flash.transitioned')}
                                </p>
                            ) : null}
                            <FormError message={(form.errors as Record<string, string | undefined>).transition} />
                            <ul className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                                {next.conditions.map((condition) => (
                                    <ConditionRow key={condition.key} condition={condition} />
                                ))}
                            </ul>
                            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                                <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                                    {t('transition.onlyActor', { role: t(`roles.${next.actor}.name`).toLocaleLowerCase(locale) })}{' '}
                                    {next.canTransition
                                        ? null
                                        : progress.readiness.checkable < progress.readiness.total
                                          ? t('hub.nextPending')
                                          : t('transition.notYet')}
                                </p>
                                {next.canTransition ? (
                                    <Button
                                        type="button"
                                        onClick={transition}
                                        disabled={form.processing}
                                        data-testid="transition-button"
                                    >
                                        {t('transition.moveTo', { status: t(`statuses.${next.to}`) })}
                                    </Button>
                                ) : null}
                            </div>
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
