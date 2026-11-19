import { useForm } from '@inertiajs/react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import KickoffController from '@/actions/App/Http/Controllers/Setup/KickoffController';
import { Field, FormError, Panel, SetupShell, TextArea } from '@/components/nscas/setup-shell';
import type { SetupCommon } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n';

type Kickoff = {
    leadership?: { date?: string | null; leader?: string | null; note?: string | null };
    briefing?: { date?: string | null; channels?: string[]; note?: string | null };
} | null;

type Calibration = { date?: string | null; note?: string | null; attendees?: number[] } | null;

type Props = SetupCommon & {
    kickoff: Kickoff;
    calibration: Calibration;
    team: { userId: number; name: string; role: string }[];
    channels: string[];
    kickoffComplete: boolean;
    calibrationComplete: boolean;
};

function Status({ done }: { done: boolean }) {
    const t = useT();
    return done ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle2 aria-hidden className="size-4" />
            {t('kickoff.complete')}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-deep">
            <CircleDashed aria-hidden className="size-4" />
            {t('kickoff.incomplete')}
        </span>
    );
}

/**
 * Halaman komunikasi awal (tahap 1): komitmen pimpinan, penjelasan kepada pekerja, dan kalibrasi asesor. Keduanya
 * syarat sebelum parameter dikunci (docs/12 temuan T2).
 */
export default function SetupKickoff(props: Props) {
    const t = useT();
    const disabled = !props.canEdit;
    const kickoff = useForm({
        leadership: {
            date: props.kickoff?.leadership?.date ?? '',
            leader: props.kickoff?.leadership?.leader ?? '',
            note: props.kickoff?.leadership?.note ?? '',
        },
        briefing: {
            date: props.kickoff?.briefing?.date ?? '',
            channels: props.kickoff?.briefing?.channels ?? [],
            note: props.kickoff?.briefing?.note ?? '',
        },
    });
    const calibration = useForm({
        date: props.calibration?.date ?? '',
        note: props.calibration?.note ?? '',
        attendees: props.calibration?.attendees ?? [],
    });
    const kErrors = kickoff.errors as Record<string, string | undefined>;
    const cErrors = calibration.errors as Record<string, string | undefined>;
    const blankToNull = (value: string) => (value.trim() === '' ? null : value);

    return (
        <SetupShell module="kickoff" common={props}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('kickoff.intro')}</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    kickoff.transform((data) => ({
                        leadership: {
                            date: blankToNull(data.leadership.date),
                            leader: blankToNull(data.leadership.leader),
                            note: blankToNull(data.leadership.note),
                        },
                        briefing: {
                            date: blankToNull(data.briefing.date),
                            channels: data.briefing.channels,
                            note: blankToNull(data.briefing.note),
                        },
                    }));
                    kickoff.put(KickoffController.update.url(props.assessment.id), { preserveScroll: true });
                }}
                className="space-y-8"
            >
                <FormError message={kErrors.form} />
                <Panel title={t('kickoff.leadershipTitle')} hint={t('kickoff.leadershipHint')}>
                    <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
                        <Field id="leadership-date" label={t('kickoff.leadershipDate')} error={kErrors['leadership.date']}>
                            <Input
                                id="leadership-date"
                                type="date"
                                value={kickoff.data.leadership.date}
                                onChange={(e) =>
                                    kickoff.setData('leadership', { ...kickoff.data.leadership, date: e.target.value })
                                }
                                disabled={disabled}
                            />
                        </Field>
                        <Field id="leadership-leader" label={t('kickoff.leader')} error={kErrors['leadership.leader']}>
                            <Input
                                id="leadership-leader"
                                value={kickoff.data.leadership.leader}
                                onChange={(e) =>
                                    kickoff.setData('leadership', { ...kickoff.data.leadership, leader: e.target.value })
                                }
                                disabled={disabled}
                            />
                        </Field>
                        <Field id="leadership-note" label={t('kickoff.leadershipNote')} className="sm:col-span-2">
                            <TextArea
                                id="leadership-note"
                                value={kickoff.data.leadership.note}
                                onChange={(e) =>
                                    kickoff.setData('leadership', { ...kickoff.data.leadership, note: e.target.value })
                                }
                                disabled={disabled}
                            />
                        </Field>
                    </div>
                </Panel>
                <Panel title={t('kickoff.briefingTitle')} hint={t('kickoff.briefingHint')}>
                    <div className="grid gap-5">
                        <Field
                            id="briefing-date"
                            label={t('kickoff.briefingDate')}
                            error={kErrors['briefing.date']}
                            className="sm:max-w-48"
                        >
                            <Input
                                id="briefing-date"
                                type="date"
                                value={kickoff.data.briefing.date}
                                onChange={(e) => kickoff.setData('briefing', { ...kickoff.data.briefing, date: e.target.value })}
                                disabled={disabled}
                            />
                        </Field>
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-foreground">{t('kickoff.channels')}</legend>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {props.channels.map((channel) => {
                                    const checked = kickoff.data.briefing.channels.includes(channel);
                                    return (
                                        <label key={channel} className="flex items-center gap-2.5 text-sm text-foreground">
                                            <Checkbox
                                                checked={checked}
                                                disabled={disabled}
                                                onCheckedChange={(value) =>
                                                    kickoff.setData('briefing', {
                                                        ...kickoff.data.briefing,
                                                        channels: value
                                                            ? [...kickoff.data.briefing.channels, channel]
                                                            : kickoff.data.briefing.channels.filter((c) => c !== channel),
                                                    })
                                                }
                                            />
                                            {t(`kickoff.channelNames.${channel}`)}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                        <Field id="briefing-note" label={t('kickoff.briefingNote')} error={kErrors['briefing.note']}>
                            <TextArea
                                id="briefing-note"
                                value={kickoff.data.briefing.note}
                                onChange={(e) => kickoff.setData('briefing', { ...kickoff.data.briefing, note: e.target.value })}
                                disabled={disabled}
                            />
                        </Field>
                    </div>
                </Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Status done={props.kickoffComplete} />
                    {props.canEdit ? (
                        <Button type="submit" disabled={kickoff.processing}>
                            {kickoff.processing ? t('common.saving') : t('kickoff.saveKickoff')}
                        </Button>
                    ) : null}
                </div>
            </form>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    calibration.transform((data) => ({ ...data, note: blankToNull(data.note) }));
                    calibration.put(KickoffController.calibration.url(props.assessment.id), { preserveScroll: true });
                }}
            >
                <Panel title={t('kickoff.calibrationTitle')} hint={t('kickoff.calibrationHint')}>
                    <FormError message={cErrors.form} />
                    {props.team.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('kickoff.noTeam')}</p>
                    ) : (
                        <div className="grid gap-5">
                            <Field
                                id="calibration-date"
                                label={t('kickoff.calibrationDate')}
                                error={cErrors.date}
                                className="sm:max-w-48"
                            >
                                <Input
                                    id="calibration-date"
                                    type="date"
                                    value={calibration.data.date}
                                    onChange={(e) => calibration.setData('date', e.target.value)}
                                    disabled={disabled}
                                    required
                                />
                            </Field>
                            <fieldset className="space-y-2">
                                <legend className="text-sm font-medium text-foreground">{t('kickoff.attendees')}</legend>
                                <ul className="grid gap-2 sm:grid-cols-2">
                                    {props.team.map((member) => (
                                        <li key={member.userId}>
                                            <label className="flex items-center gap-2.5 text-sm text-foreground">
                                                <Checkbox
                                                    checked={calibration.data.attendees.includes(member.userId)}
                                                    disabled={disabled}
                                                    onCheckedChange={(value) =>
                                                        calibration.setData(
                                                            'attendees',
                                                            value
                                                                ? [...calibration.data.attendees, member.userId]
                                                                : calibration.data.attendees.filter((id) => id !== member.userId),
                                                        )
                                                    }
                                                />
                                                <span>
                                                    {member.name}
                                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                                        {t(`roles.${member.role}.name`)}
                                                    </span>
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </fieldset>
                            <Field id="calibration-note" label={t('kickoff.calibrationNote')}>
                                <TextArea
                                    id="calibration-note"
                                    value={calibration.data.note}
                                    onChange={(e) => calibration.setData('note', e.target.value)}
                                    disabled={disabled}
                                />
                            </Field>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Status done={props.calibrationComplete} />
                        {props.canEdit && props.team.length > 0 ? (
                            <Button type="submit" disabled={calibration.processing}>
                                {calibration.processing ? t('common.saving') : t('kickoff.saveCalibration')}
                            </Button>
                        ) : null}
                    </div>
                </Panel>
            </form>
        </SetupShell>
    );
}
