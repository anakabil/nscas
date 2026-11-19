import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { AccountTile, Container, SectionHeading, StageCard, StageMeter, TaskTile } from '@/components/nscas/parts';
import { formatDate, useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { User } from '@/types/auth';
import type { AccountMenuItem, AssessmentMenu, AssessmentSummary, Persona } from '@/types/nscas';

type Props = {
    persona: Persona;
    accountMenu: AccountMenuItem[];
    assessments: AssessmentSummary[];
    selected: AssessmentMenu | null;
};

// Beranda: menu utama menurut tahap penilaian dan menurut jenis akun.
export default function Home({ persona, accountMenu, assessments, selected }: Props) {
    const t = useT();
    const locale = useLocale();
    const user = usePage<{ auth: { user: User } }>().props.auth.user;
    const roleKey = persona.primaryRole ?? 'none';
    const operator = persona.roles.some((role) => ['SUPER_ADMIN', 'LEAD_ASSESSOR', 'ASSESSOR'].includes(role));

    return (
        <>
            <Head title={t('home.title')} />

            <section className="bg-obsidian-dial text-white">
                <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end lg:py-16">
                    <div className="space-y-6">
                        <p className="eyebrow text-gold">{t('home.title')}</p>
                        <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">
                            {t('home.greeting', { name: user.name })}
                        </h1>
                        <p className="max-w-xl text-base leading-relaxed text-white/70">{t(`roles.${roleKey}.task`)}</p>
                        <dl className="flex flex-wrap gap-x-10 gap-y-4 pt-2 text-sm">
                            <div>
                                <dt className="eyebrow text-white/45">{t('home.roleLabel')}</dt>
                                <dd
                                    className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-gold/50 px-3 py-1 font-semibold text-gold-soft"
                                    data-testid="persona-role"
                                >
                                    <span aria-hidden className="size-1.5 rounded-full bg-gold" />
                                    {t(`roles.${roleKey}.name`)}
                                </dd>
                            </div>
                            {persona.organizations.length > 0 ? (
                                <div>
                                    <dt className="eyebrow text-white/45">{t('home.organizationLabel')}</dt>
                                    <dd className="mt-1.5 py-1 font-medium text-silver-bright">
                                        {persona.organizations.join(', ')}
                                    </dd>
                                </div>
                            ) : null}
                        </dl>
                    </div>

                    {selected ? (
                        <div
                            className="rounded-2xl border border-white/12 bg-white/[0.045] p-6 backdrop-blur-sm"
                            data-testid="selected-assessment"
                        >
                            <p className="eyebrow text-white/45">{t('home.selectedLabel')}</p>
                            <p className="mt-3 font-display text-2xl leading-snug font-semibold">{selected.name}</p>
                            <p className="mt-1 text-sm text-white/65">{selected.organization}</p>
                            <div className="mt-5 space-y-2.5">
                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="font-semibold text-gold-soft">
                                        {selected.stage ? t('home.stageLine', { number: selected.stage }) : t('home.closedLine')}
                                    </span>
                                    <span className="text-white/60">{t(`statuses.${selected.status}`)}</span>
                                </div>
                                <StageMeter stages={selected.stages} />
                            </div>
                            <Link
                                href={selected.href}
                                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-obsidian transition-colors hover:bg-silver-bright"
                            >
                                {t('home.openHub')}
                                <ArrowRight aria-hidden className="size-4" />
                            </Link>
                        </div>
                    ) : null}
                </Container>
            </section>

            <div className="border-b border-border bg-card">
                <Container className="py-3 text-xs leading-relaxed text-muted-foreground">{t('app.rebuildNotice')}</Container>
            </div>

            <Container className="space-y-16 py-12">
                {selected === null ? (
                    <section className="frame-silver rounded-xl p-8 text-center" data-testid="home-empty">
                        <h2 className="font-display text-2xl font-semibold text-obsidian">{t('home.emptyTitle')}</h2>
                        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                            {persona.primaryRole === null
                                ? t('roles.none.task')
                                : operator
                                  ? t('home.emptyOperator')
                                  : t('home.emptyClient')}
                        </p>
                    </section>
                ) : null}

                {selected && selected.roleTasks.length > 0 ? (
                    <section className="space-y-6" data-testid="menu-by-role">
                        <SectionHeading
                            eyebrow={t('home.roleLabel')}
                            title={t('home.byRoleTitle', { role: t(`roles.${selected.role ?? roleKey}.name`) })}
                            intro={t('home.byRoleIntro')}
                        />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {selected.roleTasks.map((module) => (
                                <TaskTile key={module.key} module={module} />
                            ))}
                        </div>
                    </section>
                ) : null}

                {selected ? (
                    <section className="space-y-6" data-testid="menu-by-stage">
                        <SectionHeading eyebrow={selected.name} title={t('home.byStageTitle')} intro={t('home.byStageIntro')} />
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {selected.stages.map((stage) => (
                                <StageCard key={stage.key} stage={stage} />
                            ))}
                        </div>
                    </section>
                ) : null}

                {assessments.length > 1 ? (
                    <section className="space-y-6" data-testid="home-assessments">
                        <SectionHeading title={t('home.assessmentsTitle')} intro={t('home.assessmentsIntro')} />
                        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                            {assessments.map((assessment) => {
                                const shown = assessment.id === selected?.id;
                                return (
                                    <li
                                        key={assessment.id}
                                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-foreground">{assessment.name}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {assessment.organization}
                                                {' · '}
                                                {t('assessments.periodRange', {
                                                    start: formatDate(assessment.periodStart, locale),
                                                    end: formatDate(assessment.periodEnd, locale),
                                                })}
                                            </p>
                                        </div>
                                        <p className="text-sm font-medium text-charcoal sm:w-44">
                                            {assessment.stage
                                                ? t('home.stageLine', { number: assessment.stage })
                                                : t('home.closedLine')}
                                            <span className="block text-xs font-normal text-muted-foreground">
                                                {t(`statuses.${assessment.status}`)}
                                            </span>
                                        </p>
                                        <Link
                                            href={`/home?assessment=${assessment.id}`}
                                            preserveScroll
                                            aria-current={shown ? 'true' : undefined}
                                            className={cn(
                                                'inline-flex shrink-0 items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition-colors',
                                                shown
                                                    ? 'border-gold/60 bg-gold/15 text-gold-deep'
                                                    : 'border-border hover:border-silver-dim',
                                            )}
                                        >
                                            {shown ? t('home.shown') : t('home.showOnHome')}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ) : null}

                <section className="space-y-6" data-testid="menu-account">
                    <SectionHeading title={t('home.accountTitle')} />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {accountMenu.map((item) => (
                            <AccountTile key={item.key} item={item} />
                        ))}
                    </div>
                </section>
            </Container>
        </>
    );
}
