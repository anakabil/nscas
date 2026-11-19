import { Link } from '@inertiajs/react';
import { ArrowRight, Check } from 'lucide-react';
import { ACCOUNT_ICONS, MODULE_ICONS } from '@/components/icons/module-icons';
import { STAGE_ICONS, type StageKey } from '@/components/icons/stage-icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { AccountMenuItem, ModuleLink, StageGroup, StageState } from '@/types/nscas';

/** Wadah isi halaman dengan lebar baca yang sama di seluruh aplikasi. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>;
}

/** Judul bagian: label kecil berhuruf besar, judul serif, dan pengantar. */
export function SectionHeading({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
    return (
        <header className="max-w-3xl space-y-3">
            {eyebrow ? (
                <p className="eyebrow flex items-center gap-3 text-gold-deep">
                    <span aria-hidden className="h-px w-8 bg-gold" />
                    {eyebrow}
                </p>
            ) : null}
            <h2 className="font-display text-[1.75rem] leading-[1.15] text-obsidian sm:text-[2.15rem]">{title}</h2>
            {intro ? <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">{intro}</p> : null}
        </header>
    );
}

/** Tanda fase pembangunan untuk halaman yang belum dibangun ulang. */
export function PhaseTag({ phase, className }: { phase: string; className?: string }) {
    const t = useT();
    return (
        <span
            title={t('home.buildPhaseHint', { phase })}
            className={cn(
                'numeral shrink-0 text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase',
                className,
            )}
        >
            {t('home.buildPhase', { phase })}
        </span>
    );
}

const STATE_STYLE: Record<StageState, string> = {
    done: 'border-success/30 bg-success/10 text-success',
    current: 'border-gold/60 bg-gold/15 text-gold-deep',
    upcoming: 'border-border bg-muted text-muted-foreground',
};

export function StageStateChip({ state }: { state: StageState }) {
    const t = useT();
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[0.6875rem] font-semibold tracking-[0.02em]',
                STATE_STYLE[state],
            )}
        >
            {state === 'done' ? <Check aria-hidden className="size-3" strokeWidth={2.5} /> : null}
            {state === 'current' ? <span aria-hidden className="size-1.5 rounded-full bg-gold-deep" /> : null}
            {t(`stageStates.${state}`)}
        </span>
    );
}

/** Satu baris tautan halaman kerja di dalam kartu tahap. */
export function ModuleRow({ module }: { module: ModuleLink }) {
    const t = useT();
    const Icon = MODULE_ICONS[module.key];
    return (
        <li>
            <Link
                href={module.href}
                className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:bg-muted"
            >
                {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-silver-dim" strokeWidth={1.5} /> : null}
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{t(`modules.${module.key}.title`)}</span>
                {module.ready ? (
                    <ArrowRight
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    />
                ) : (
                    <PhaseTag phase={module.buildPhase} />
                )}
            </Link>
        </li>
    );
}

/** Kartu satu tahap penilaian: nomor, ikon, keadaan, ringkasan, dan halaman yang boleh dibuka. */
export function StageCard({ stage }: { stage: StageGroup }) {
    const t = useT();
    const Icon = STAGE_ICONS[stage.key as StageKey];
    const current = stage.state === 'current';
    return (
        <article
            data-testid={`stage-${stage.number}`}
            data-state={stage.state}
            className={cn(
                'flex h-full flex-col rounded-lg bg-card p-7',
                current ? 'frame-gold shadow-[0_18px_40px_-24px_rgb(138_109_27/0.55)]' : 'frame-silver',
                stage.state === 'upcoming' && 'opacity-[0.93]',
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <span
                    aria-hidden
                    className={cn(
                        'flex size-12 items-center justify-center rounded-full border',
                        current
                            ? 'border-gold/70 bg-obsidian text-silver-bright shadow-[inset_0_0_0_3px_var(--obsidian),inset_0_0_0_4px_rgb(212_175_55/0.35)]'
                            : 'border-silver bg-card text-charcoal',
                    )}
                >
                    <Icon className="size-[1.375rem]" accent={current ? 'var(--gold)' : 'var(--gold-deep)'} />
                </span>
                <span
                    aria-hidden
                    className={cn(
                        'font-display text-5xl leading-none font-normal tabular-nums',
                        current ? 'text-gold' : 'text-silver',
                    )}
                >
                    {String(stage.number).padStart(2, '0')}
                </span>
            </div>
            <div className="mt-5 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h3 className="font-display text-[1.375rem] leading-tight text-obsidian">
                        <span className="sr-only">{stage.number}. </span>
                        {t(`stages.${stage.key}.title`)}
                    </h3>
                    <StageStateChip state={stage.state} />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(`stages.${stage.key}.summary`)}</p>
            </div>
            <div className={cn('my-4', current ? 'hairline-gold' : 'hairline-silver')} />
            {stage.modules.length > 0 ? (
                <ul className="-mx-2 space-y-0.5">
                    {stage.modules.map((module) => (
                        <ModuleRow key={module.key} module={module} />
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground italic">{t('home.noModules')}</p>
            )}
        </article>
    );
}

/** Ubin tugas utama peran: ikon, nama halaman, dan keterangan satu baris. */
export function TaskTile({ module }: { module: ModuleLink }) {
    const t = useT();
    const Icon = MODULE_ICONS[module.key];
    return (
        <Link
            href={module.href}
            className="group flex h-full items-start gap-4 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow] duration-200 hover:border-gold/70 hover:shadow-[0_14px_30px_-22px_rgb(132_104_26/0.6)] focus-visible:border-gold/70"
        >
            <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-md bg-obsidian text-silver-bright shadow-[inset_0_0_0_1px_rgb(212_175_55/0.35)]"
            >
                {Icon ? <Icon className="size-5" strokeWidth={1.5} /> : null}
            </span>
            <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center gap-2">
                    <span className="truncate text-[0.9375rem] font-semibold text-foreground">
                        {t(`modules.${module.key}.title`)}
                    </span>
                    {module.ready ? null : <PhaseTag phase={module.buildPhase} />}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{t(`modules.${module.key}.hint`)}</span>
            </span>
        </Link>
    );
}

/** Ubin menu tingkat akun. */
export function AccountTile({ item }: { item: AccountMenuItem }) {
    const t = useT();
    const Icon = ACCOUNT_ICONS[item.key];
    return (
        <Link
            href={item.path}
            className="group flex h-full items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors duration-200 hover:border-silver-dim focus-visible:border-silver-dim"
        >
            <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-silver bg-card text-charcoal"
            >
                {Icon ? <Icon className="size-5" strokeWidth={1.5} /> : null}
            </span>
            <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center gap-2">
                    <span className="truncate text-[0.9375rem] font-semibold text-foreground">
                        {t(`accountMenu.${item.key}.title`)}
                    </span>
                    {item.ready ? null : <PhaseTag phase={item.buildPhase} />}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{t(`accountMenu.${item.key}.hint`)}</span>
            </span>
        </Link>
    );
}

/** Penanda kemajuan enam ruas. Di bidang gelap: selesai perak, berjalan emas, berikutnya samar. */
export function StageMeter({
    stages,
    tone = 'dark',
}: {
    stages: Pick<StageGroup, 'number' | 'state'>[];
    tone?: 'dark' | 'light';
}) {
    const palette =
        tone === 'dark'
            ? { done: 'bg-silver', current: 'bg-gold', upcoming: 'bg-white/15' }
            : { done: 'bg-charcoal', current: 'bg-gold', upcoming: 'bg-border' };
    return (
        <div aria-hidden className="flex gap-1.5">
            {stages.map((stage) => (
                <span key={stage.number} className={cn('h-1 flex-1 rounded-full', palette[stage.state])} />
            ))}
        </div>
    );
}
