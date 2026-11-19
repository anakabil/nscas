import { Head, Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/nscas/parts';
import { formatDate, useLocale, useT } from '@/i18n';
import type { AssessmentSummary } from '@/types/nscas';

export default function AssessmentsIndex({ assessments }: { assessments: AssessmentSummary[] }) {
    const t = useT();
    const locale = useLocale();
    return (
        <>
            <Head title={t('assessments.title')} />
            <Container className="space-y-8 py-10">
                <header className="space-y-2">
                    <h1 className="font-display text-[2.25rem] leading-tight text-ink sm:text-[2.6rem]">
                        {t('assessments.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t('assessments.intro')}</p>
                </header>
                <div className="hairline-taupe" />
                {assessments.length === 0 ? (
                    <p
                        className="frame-hairline rounded-lg p-8 text-center text-sm text-muted-foreground"
                        data-testid="assessments-empty"
                    >
                        {t('assessments.empty')}
                    </p>
                ) : (
                    <ul className="grid gap-4 lg:grid-cols-2" data-testid="assessments-list">
                        {assessments.map((assessment) => (
                            <li key={assessment.id}>
                                <Link
                                    href={assessment.href}
                                    className="group frame-hairline flex h-full flex-col gap-4 rounded-lg p-6 transition-shadow hover:shadow-[0_18px_40px_-28px_rgb(26_26_26/0.5)]"
                                >
                                    <div className="space-y-1">
                                        <p className="eyebrow text-gold-deep">{assessment.organization}</p>
                                        <p className="font-display text-[1.4rem] leading-snug text-ink">{assessment.name}</p>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('assessments.stage')}</dt>
                                            <dd className="font-semibold">
                                                {assessment.stage
                                                    ? t('home.stageLine', { number: assessment.stage })
                                                    : t('home.closedLine')}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('assessments.status')}</dt>
                                            <dd className="font-semibold">{t(`statuses.${assessment.status}`)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('assessments.period')}</dt>
                                            <dd>
                                                {t('assessments.periodRange', {
                                                    start: formatDate(assessment.periodStart, locale),
                                                    end: formatDate(assessment.periodEnd, locale),
                                                })}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('assessments.yourRole')}</dt>
                                            <dd>{t(`roles.${assessment.role ?? 'none'}.name`)}</dd>
                                        </div>
                                    </dl>
                                    <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-ink">
                                        {t('assessments.open')}
                                        <ArrowRight
                                            aria-hidden
                                            className="size-4 transition-transform group-hover:translate-x-0.5"
                                        />
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Container>
        </>
    );
}
