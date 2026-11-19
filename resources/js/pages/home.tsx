import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { AccountTile, Container, SectionHeading, StageCard, StageMeter, TaskTile } from '@/components/nscas/parts';
import { ProgressDashboard } from '@/components/nscas/progress-dashboard';
import { formatDate, useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { User } from '@/types/auth';
import type { AccountMenuItem, AssessmentMenu, AssessmentSummary, Dashboard, Persona } from '@/types/nscas';

type Props = {
    persona: Persona;
    accountMenu: AccountMenuItem[];
    assessments: AssessmentSummary[];
    selected: AssessmentMenu | null;
    dashboard: Dashboard | null;
};

// Penanda tempat nama di dalam kalimat sapaan, agar nama dapat dicetak miring tanpa memecah kunci terjemahan.
const NAME_SLOT = '\u2063';

/** Kalimat sapaan dengan nama pengguna dicetak miring berwarna emas muda, gaya judul majalah klasik. */
function Greeting({ text, name }: { text: string; name: string }) {
    const [before, after = ''] = text.split(NAME_SLOT);
    return (
        <>
            {before}
            <em className="text-gold-soft">{name}</em>
            {after}
        </>
    );
}

// Beranda: menu utama menurut tahap penilaian dan menurut jenis akun.
export default function Home({ persona, accountMenu, assessments, selected, dashboard }: Props) {
    const t = useT();
    const locale = useLocale();
    const user = usePage<{ auth: { user: User } }>().props.auth.user;
    const roleKey = persona.primaryRole ?? 'none';
    const operator = persona.roles.some((role) => ['SUPER_ADMIN', 'LEAD_ASSESSOR', 'ASSESSOR'].includes(role));

    return (
        <>
            <Head title={t('home.title')} />

            <section className="bg-maroon-dial text-white">
                <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end lg:py-16">
                    <div className="space-y-6">
                        <p className="eyebrow flex items-center gap-3 text-gold">
                            <span aria-hidden className="h-px w-10 bg-gold/80" />
                            {t('home.title')}
                        </p>
                        <h1 className="font-display text-[2.6rem] leading-[1.06] sm:text-6xl">
                            <Greeting text={t('home.greeting', { name: NAME_SLOT })} name={user.name} />
                        </h1>
                        <p className="max-w-xl text-[1.0625rem] leading-relaxed text-white/72">{t(`roles.${roleKey}.task`)}</p>
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
                                    <dd className="mt-1.5 py-1 font-medium text-parchment">{persona.organizations.join(', ')}</dd>
                                </div>
                            ) : null}
                        </dl>
                    </div>

                    {selected ? (
                        <div className="frame-maroon rounded-lg p-7" data-testid="selected-assessment">
                            <p className="eyebrow text-white/50">{t('home.selectedLabel')}</p>
                            <p className="mt-3 font-display text-[1.6rem] leading-snug">{selected.name}</p>
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
                                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-gradient-to-b from-white to-parchment px-4 py-3 text-sm font-semibold tracking-[0.02em] text-ink shadow-[inset_0_-1px_0_rgb(140_128_115/0.6)] transition-colors hover:to-taupe"
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
                {dashboard ? <ProgressDashboard dashboard={dashboard} /> : null}

                {selected === null ? (
                    <section className="frame-hairline rounded-lg p-10 text-center" data-testid="home-empty">
                        <h2 className="font-display text-[1.75rem] text-ink">{t('home.emptyTitle')}</h2>
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
                            title={t('home.byRoleTitle', {
                                // Nama jenis akun di tengah kalimat ditulis huruf kecil (EYD V).
                                role: t(`roles.${selected.role ?? roleKey}.name`).toLocaleLowerCase(locale),
                            })}
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
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                            {assessments.map((assessment) => {
                                const shown = assessment.id === selected?.id;
                                return (
                                    <li
                                        key={assessment.id}
                                        className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-6"
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
                                        <p className="numeral text-sm font-medium text-charcoal sm:w-44">
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
                                                'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border px-3.5 py-2 text-[0.8125rem] font-semibold transition-colors',
                                                shown
                                                    ? 'border-gold/60 bg-gold/10 text-gold-deep'
                                                    : 'border-border text-charcoal hover:border-maroon hover:text-maroon',
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
