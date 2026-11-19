import { useForm } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import ReportController from '@/actions/App/Http/Controllers/Results/ReportController';
import CommunicationController from '@/actions/App/Http/Controllers/Results/CommunicationController';
import { formatDay } from '@/components/nscas/action-format';
import { CollectionShell } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, Panel, TextArea, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

type Entry = {
    id: string;
    date: string;
    channels: string[];
    audience: string;
    reached: number | null;
    note: string | null;
    by: string | null;
};
type Props = CollectionCommon & {
    canRecord: boolean;
    channels: string[];
    summary: { id: string; version: number; status: 'DRAFT' | 'FINAL' } | null;
    records: Entry[];
};

/** Komunikasi hasil kepada pekerja (docs/12 temuan T5). */
export default function Communication(props: Props) {
    const t = useT();
    const locale = useLocale();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const form = useForm<{ date: string; channels: string[]; audience: string; reached: string; note: string }>({
        date: today,
        channels: [],
        audience: '',
        reached: '',
        note: '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const assessment = props.assessment.id;

    return (
        <CollectionShell module="communication" common={props} canEdit={props.canRecord} showWindow={false}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('communicationPage.intro')}</p>
            <Panel title={t('communicationPage.summary.title')}>
                {props.summary ? (
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm text-charcoal">
                            {t('communicationPage.summary.status', {
                                version: props.summary.version,
                                status: props.summary.status === 'FINAL' ? t('reportPage.final') : t('reportPage.draft'),
                            })}
                        </p>
                        <Button asChild variant="outline" size="sm">
                            <a
                                href={ReportController.show.url({ assessment, report: props.summary.id })}
                                target="_blank"
                                rel="noopener"
                            >
                                <ExternalLink aria-hidden />
                                {t('communicationPage.summary.open')}
                            </a>
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">{t('communicationPage.summary.none')}</p>
                )}
            </Panel>
            {props.canRecord ? (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.transform((data) => ({
                            ...data,
                            reached: data.reached === '' ? null : Number(data.reached),
                            note: data.note === '' ? null : data.note,
                        }));
                        form.post(CommunicationController.store.url(assessment), {
                            preserveScroll: true,
                            onSuccess: () => form.reset('audience', 'reached', 'note', 'channels'),
                        });
                    }}
                >
                    <Panel title={t('communicationPage.form.title')}>
                        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                            <Field id="comm-date" label={t('communicationPage.form.date')} error={errors.date}>
                                <Input
                                    id="comm-date"
                                    type="date"
                                    required
                                    max={today}
                                    value={form.data.date}
                                    onChange={(e) => form.setData('date', e.target.value)}
                                />
                            </Field>
                            <Field
                                id="comm-audience"
                                label={t('communicationPage.form.audience')}
                                hint={t('communicationPage.form.audienceHint')}
                                error={errors.audience}
                            >
                                <Input
                                    id="comm-audience"
                                    required
                                    minLength={3}
                                    maxLength={300}
                                    value={form.data.audience}
                                    onChange={(e) => form.setData('audience', e.target.value)}
                                />
                            </Field>
                        </div>
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-foreground">
                                {t('communicationPage.form.channels')}
                            </legend>
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                                {props.channels.map((c) => (
                                    <label key={c} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            className="size-4 accent-maroon"
                                            checked={form.data.channels.includes(c)}
                                            onChange={(e) =>
                                                form.setData(
                                                    'channels',
                                                    e.target.checked
                                                        ? [...form.data.channels, c]
                                                        : form.data.channels.filter((x) => x !== c),
                                                )
                                            }
                                        />
                                        {t(`communicationPage.channelNames.${c}`)}
                                    </label>
                                ))}
                            </div>
                            <FormError message={errors.channels} />
                        </fieldset>
                        <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
                            <Field id="comm-reached" label={t('communicationPage.form.reached')} error={errors.reached}>
                                <Input
                                    id="comm-reached"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    value={form.data.reached}
                                    onChange={(e) => form.setData('reached', e.target.value)}
                                />
                            </Field>
                            <Field id="comm-note" label={t('communicationPage.form.note')} error={errors.note}>
                                <TextArea
                                    id="comm-note"
                                    rows={2}
                                    maxLength={2000}
                                    value={form.data.note}
                                    onChange={(e) => form.setData('note', e.target.value)}
                                />
                            </Field>
                        </div>
                        <Button
                            type="submit"
                            disabled={form.processing || form.data.channels.length === 0}
                            data-testid="communication-save"
                        >
                            {t('communicationPage.form.save')}
                        </Button>
                    </Panel>
                </form>
            ) : null}
            <Panel title={t('communicationPage.records')}>
                {props.records.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('communicationPage.empty')}</p>
                ) : (
                    <ul className="space-y-3" data-testid="communication-records">
                        {props.records.map((r) => (
                            <li key={r.id} className="border-l-2 border-gold/60 pl-3 text-sm">
                                <p className="text-xs text-muted-foreground">
                                    {formatDay(r.date, locale)}
                                    {r.by ? `, ${t('communicationPage.by', { name: r.by })}` : ''}
                                </p>
                                <p className="text-ink">
                                    {r.audience}
                                    {r.reached
                                        ? `, ${t('communicationPage.reached', { count: formatNumber(r.reached, locale) })}`
                                        : ''}
                                </p>
                                <p className="text-xs text-charcoal">
                                    {r.channels.map((c) => t(`communicationPage.channelNames.${c}`)).join(', ')}
                                </p>
                                {r.note ? <p className="text-charcoal">{r.note}</p> : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </CollectionShell>
    );
}
