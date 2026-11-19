import { Link, router, usePoll } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { SectionHeading } from '@/components/nscas/parts';
import { formatDate, useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Dashboard, DashboardRow } from '@/types/nscas';

const POLL_MS = 60_000;

function number(value: number, locale: 'id' | 'en'): string {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID').format(value);
}

/** Bilah tipis dengan isi sebagian; dipakai untuk kesiapan, perencanaan, dan jadwal. */
function Bar({ value, tone = 'maroon', label }: { value: number; tone?: 'maroon' | 'gold' | 'warn'; label: string }) {
    const width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(value * 100)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-parchment"
        >
            <div
                className={cn(
                    'h-full rounded-full',
                    tone === 'maroon' ? 'bg-maroon' : tone === 'gold' ? 'bg-gold' : 'bg-destructive/80',
                )}
                style={{ width }}
            />
        </div>
    );
}

function ScheduleCell({ row }: { row: DashboardRow }) {
    const t = useT();
    const { phase, daysRemaining, elapsed } = row.schedule;
    const text =
        phase === 'notStarted'
            ? t('dashboard.schedule.notStarted', { days: daysRemaining - row.schedule.totalDays + 1 })
            : phase === 'ended'
              ? t('dashboard.schedule.ended', { days: Math.abs(daysRemaining) })
              : daysRemaining === 0
                ? t('dashboard.schedule.endsToday')
                : t('dashboard.schedule.running', { days: daysRemaining });
    const late = row.attention.includes('periodEnded');
    return (
        <div className="space-y-1.5">
            <p className={cn('numeral text-sm', late ? 'font-semibold text-destructive' : 'text-foreground')}>{text}</p>
            <Bar value={elapsed} tone={late ? 'warn' : 'gold'} label={text} />
        </div>
    );
}

function ReadinessCell({ row }: { row: DashboardRow }) {
    const t = useT();
    if (!row.next) {
        return <p className="text-sm text-muted-foreground">{t('dashboard.noNext')}</p>;
    }
    const { met, total, checkable } = row.readiness;
    const unknown = total - checkable;
    const label = t('dashboard.readiness', { met, total });
    return (
        <div className="space-y-1.5">
            <p className="text-sm text-foreground">
                <span className="numeral font-semibold">{label}</span>
                <span className="text-muted-foreground"> · {t(`statuses.${row.next.to}`)}</span>
            </p>
            <Bar value={total === 0 ? 0 : met / total} label={label} />
            {unknown > 0 ? <p className="text-xs text-muted-foreground">{t('dashboard.readinessUnknown', { unknown })}</p> : null}
        </div>
    );
}

function AttentionCell({ row }: { row: DashboardRow }) {
    const t = useT();
    if (row.attention.length === 0) {
        return <span className="text-sm text-muted-foreground">·</span>;
    }
    return (
        <ul className="space-y-1">
            {row.attention.map((flag) => (
                <li
                    key={flag}
                    className={cn(
                        'flex items-start gap-1.5 text-xs leading-snug',
                        flag === 'readyToAdvance' ? 'text-success' : 'text-gold-deep',
                    )}
                >
                    {flag === 'readyToAdvance' ? (
                        <CheckCircle2 aria-hidden className="mt-px size-3.5 shrink-0" />
                    ) : (
                        <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
                    )}
                    {t(`dashboard.attentionFlags.${flag}`)}
                </li>
            ))}
        </ul>
    );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'good' }) {
    const locale = useLocale();
    return (
        <div className="frame-hairline rounded-lg px-5 py-4">
            <p className="eyebrow text-muted-foreground">{label}</p>
            <p
                className={cn(
                    'numeral mt-2 font-display text-4xl leading-none',
                    tone === 'warn' && value > 0
                        ? 'text-destructive'
                        : tone === 'good' && value > 0
                          ? 'text-success'
                          : 'text-ink',
                )}
            >
                {number(value, locale)}
            </p>
        </div>
    );
}

/**
 * Dasbor progres pengukuran di beranda (fase R1). Diperbarui sendiri setiap 60 detik dengan muat ulang sebagian
 * Inertia (hanya prop dashboard), tanpa layanan pihak ketiga.
 */
export function ProgressDashboard({ dashboard }: { dashboard: Dashboard }) {
    const t = useT();
    const locale = useLocale();
    usePoll(POLL_MS, { only: ['dashboard'] });
    const time = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date(dashboard.updatedAt));
    const maxStage = Math.max(1, ...dashboard.totals.byStage);

    return (
        <section className="space-y-6" data-testid="progress-dashboard" aria-live="polite">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <SectionHeading eyebrow={t('dashboard.eyebrow')} title={t('dashboard.title')} intro={t('dashboard.intro')} />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="numeral">{t('dashboard.updatedAt', { time })}</span>
                    <button
                        type="button"
                        onClick={() => router.reload({ only: ['dashboard'] })}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-medium text-foreground hover:bg-muted"
                    >
                        <RefreshCw aria-hidden className="size-3.5" />
                        {t('dashboard.refresh')}
                    </button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
                <Tile label={t('dashboard.active')} value={dashboard.totals.active} />
                <Tile label={t('dashboard.attention')} value={dashboard.totals.attention} tone="warn" />
                <Tile label={t('dashboard.ready')} value={dashboard.totals.ready} tone="good" />
                <Tile label={t('dashboard.closed')} value={dashboard.totals.closed} />
                <div className="frame-hairline rounded-lg px-5 py-4 sm:col-span-2 lg:col-span-1">
                    <p className="eyebrow text-muted-foreground">{t('dashboard.byStage')}</p>
                    <ol className="mt-3 grid grid-cols-6 items-end gap-2" aria-label={t('dashboard.byStage')}>
                        {dashboard.totals.byStage.map((count, index) => (
                            <li key={index} className="flex flex-col items-center gap-1.5">
                                <span className="numeral text-xs font-semibold text-ink">{count}</span>
                                <span
                                    aria-hidden
                                    className={cn('w-full rounded-sm', count > 0 ? 'bg-maroon' : 'bg-parchment')}
                                    style={{ height: `${8 + (count / maxStage) * 36}px` }}
                                />
                                <span
                                    className="text-[0.65rem] text-muted-foreground"
                                    title={t(
                                        `stages.${['PLANNING', 'DATA_COLLECTION', 'VALIDATION', 'RATING', 'REPORTING', 'MONITORING'][index]}.title`,
                                    )}
                                >
                                    {index + 1}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            {dashboard.rows.length === 0 ? (
                <p className="frame-hairline rounded-lg p-6 text-sm text-muted-foreground">{t('dashboard.empty')}</p>
            ) : (
                <div className="frame-hairline overflow-x-auto rounded-lg">
                    <table className="w-full min-w-[60rem] text-left text-sm" data-testid="progress-table">
                        <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground">
                                <th className="px-5 py-3 font-medium">{t('dashboard.columns.assessment')}</th>
                                <th className="px-4 py-3 font-medium">{t('dashboard.columns.stage')}</th>
                                <th className="w-56 px-4 py-3 font-medium">{t('dashboard.columns.readiness')}</th>
                                <th className="w-32 px-4 py-3 font-medium">{t('dashboard.columns.planning')}</th>
                                <th className="w-40 px-4 py-3 font-medium">{t('dashboard.columns.schedule')}</th>
                                <th className="w-56 px-4 py-3 font-medium">{t('dashboard.columns.attention')}</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className={cn(
                                        'border-b border-border/70 align-top last:border-0',
                                        row.closed && 'opacity-60',
                                    )}
                                    data-assessment={row.id}
                                >
                                    <td className="px-5 py-4">
                                        <p className="text-xs text-muted-foreground">{row.organization}</p>
                                        <p className="font-medium text-ink">{row.name}</p>
                                        <p className="numeral mt-1 text-xs text-muted-foreground">
                                            {t('assessments.periodRange', {
                                                start: formatDate(row.periodStart, locale),
                                                end: formatDate(row.periodEnd, locale),
                                            })}
                                        </p>
                                        <p className="numeral mt-1 text-xs text-muted-foreground">
                                            {[
                                                row.workers > 0
                                                    ? t('dashboard.workers', { count: number(row.workers, locale) })
                                                    : null,
                                                row.surveyTarget !== null
                                                    ? t('dashboard.surveyTarget', { count: number(row.surveyTarget, locale) })
                                                    : null,
                                                t('dashboard.team', { count: row.teamSize }),
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <p className="numeral font-semibold text-ink">
                                            {row.stage ? t('dashboard.stageShort', { number: row.stage }) : t('home.closedLine')}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{t(`statuses.${row.status}`)}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <ReadinessCell row={row} />
                                    </td>
                                    <td className="px-4 py-4">
                                        <StageProgressCell row={row} />
                                    </td>
                                    <td className="px-4 py-4">
                                        <ScheduleCell row={row} />
                                    </td>
                                    <td className="px-4 py-4">
                                        <AttentionCell row={row} />
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <Link
                                            href={row.href}
                                            className="inline-flex items-center gap-1 text-sm font-semibold text-maroon hover:underline"
                                        >
                                            {t('dashboard.open')}
                                            <ArrowRight aria-hidden className="size-3.5" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{t('dashboard.legend')}</p>
        </section>
    );
}

/**
 * Kemajuan tahap berjalan: kelengkapan halaman perencanaan pada tahap 1, lalu partisipasi survei terhadap sasaran
 * sejak tahap 2. Jumlah selesai di bawah ambang sel tidak ditampilkan (aturan 3).
 */
function StageProgressCell({ row }: { row: DashboardRow }) {
    const t = useT();
    const locale = useLocale();
    if (row.stage === 1) {
        const label = t('dashboard.planning', { done: row.planning.done, total: row.planning.total });
        return (
            <div className="space-y-1.5">
                <p className="numeral text-sm text-foreground">{label}</p>
                <Bar value={row.planning.done / row.planning.total} label={label} />
            </div>
        );
    }
    if (row.stage === null) {
        return <p className="text-sm text-muted-foreground">{t('dashboard.closed')}</p>;
    }
    const p = row.participation;
    const completed = p.completed.suppressed
        ? t('dashboard.participation.suppressed', { min: p.minCell })
        : number(p.completed.value ?? 0, locale);
    const label =
        row.surveyTarget !== null
            ? t('dashboard.participation.ofTarget', { completed, target: number(row.surveyTarget, locale) })
            : t('dashboard.participation.completed', { completed });
    return (
        <div className="space-y-1.5" data-testid="participation-cell">
            <p className="numeral text-sm text-foreground">{label}</p>
            {p.rateOfTarget !== null ? <Bar value={Math.min(1, p.rateOfTarget)} label={label} /> : null}
            {p.tokens > 0 && p.strataBelowMinimum > 0 ? (
                <p className="text-xs text-gold-deep">
                    {t('dashboard.participation.strataBelow', {
                        count: p.strataBelowMinimum,
                        min: `${Math.round(p.minParticipation * 100)}%`,
                    })}
                </p>
            ) : null}
            {p.selfAssessments.issued > 0 ? (
                <p className="numeral text-xs text-muted-foreground">
                    {t('dashboard.participation.selfAssessments', {
                        submitted: p.selfAssessments.submitted,
                        issued: p.selfAssessments.issued,
                    })}
                </p>
            ) : null}
            <p className="numeral text-xs text-muted-foreground">
                {t('dashboard.participation.distribution', {
                    roster: number(p.roster, locale),
                    tokens: number(p.tokens, locale),
                })}
            </p>
        </div>
    );
}
