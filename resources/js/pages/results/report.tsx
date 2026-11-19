import { router, useForm, usePage } from '@inertiajs/react';
import { Download, ExternalLink, Eye, PenLine, Save } from 'lucide-react';
import { useState } from 'react';
import ReportController from '@/actions/App/Http/Controllers/Results/ReportController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, FormError, NativeSelect } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Kind = 'FULL' | 'EXECUTIVE_SUMMARY' | 'STATEMENT' | 'WORKER_SUMMARY';
type Version = {
    id: string;
    kind: Kind;
    version: number;
    locale: 'id' | 'en';
    status: 'DRAFT' | 'FINAL';
    signer: string | null;
    signerPosition: string | null;
    signedAt: string | null;
    createdAt: string;
    by: string | null;
    hasPdf: boolean;
};
type Props = CollectionCommon & {
    ready: boolean;
    canCreate: boolean;
    canSign: boolean;
    pdfAvailable: boolean;
    kinds: Kind[];
    versions: Version[];
};

/** Laporan dan versinya (docs/01 M11). */
export default function ReportPage(props: Props) {
    const t = useT();
    const errors = usePage<{ errors: Record<string, string | undefined> }>().props.errors;
    const [signing, setSigning] = useState<Version | null>(null);
    const [language, setLanguage] = useState<'id' | 'en'>('id');
    const assessment = props.assessment.id;

    return (
        <CollectionShell module="report" common={props} canEdit={props.canCreate} showWindow={false} readOnlyNotice={false}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('reportPage.intro')}</p>
            <FormError message={errors.form} />
            {!props.ready ? (
                <p className="text-sm text-muted-foreground" data-testid="report-not-ready">
                    {t('reportPage.notReady')}
                </p>
            ) : (
                <>
                    {props.canCreate ? (
                        <div className="max-w-xs">
                            <Field id="report-language" label={t('reportPage.language')}>
                                <NativeSelect
                                    id="report-language"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as 'id' | 'en')}
                                >
                                    {(['id', 'en'] as const).map((l) => (
                                        <option key={l} value={l}>
                                            {t(`reportPage.languages.${l}`)}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                        </div>
                    ) : null}
                    {!props.pdfAvailable ? <p className="text-xs text-muted-foreground">{t('reportPage.printHint')}</p> : null}
                    <div className="grid gap-4 md:grid-cols-2" data-testid="report-kinds">
                        {props.kinds.map((kind) => {
                            const versions = props.versions.filter((v) => v.kind === kind);
                            return (
                                <section key={kind} className="frame-hairline min-w-0 space-y-3 rounded-lg p-5" data-kind={kind}>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-semibold text-ink">{t(`reportKinds.${kind}`)}</h3>
                                        <p className="text-sm text-muted-foreground">{t(`reportPage.hints.${kind}`)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button asChild variant="outline" size="sm">
                                            <a
                                                href={`${ReportController.preview.url({ assessment, kind })}?locale=${language}`}
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                <Eye aria-hidden />
                                                {t('reportPage.preview')}
                                            </a>
                                        </Button>
                                        {props.canCreate ? (
                                            <Button
                                                size="sm"
                                                data-testid={`report-save-${kind}`}
                                                onClick={() =>
                                                    router.post(
                                                        ReportController.store.url(assessment),
                                                        { kind, locale: language },
                                                        { preserveScroll: true },
                                                    )
                                                }
                                            >
                                                <Save aria-hidden />
                                                {t('reportPage.save')}
                                            </Button>
                                        ) : null}
                                    </div>
                                    {versions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">{t('reportPage.none')}</p>
                                    ) : (
                                        <ul className="divide-y divide-border text-sm">
                                            {versions.map((v, i) => (
                                                <VersionRow
                                                    key={v.id}
                                                    version={v}
                                                    latest={i === 0}
                                                    canSign={props.canSign}
                                                    pdfAvailable={props.pdfAvailable}
                                                    assessment={assessment}
                                                    onSign={() => setSigning(v)}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                </>
            )}
            {signing ? <SignDialog version={signing} assessment={assessment} onClose={() => setSigning(null)} /> : null}
        </CollectionShell>
    );
}

function VersionRow({
    version: v,
    latest,
    canSign,
    pdfAvailable,
    assessment,
    onSign,
}: {
    version: Version;
    latest: boolean;
    canSign: boolean;
    pdfAvailable: boolean;
    assessment: string;
    onSign: () => void;
}) {
    const t = useT();
    const locale = useLocale();
    return (
        <li className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="min-w-0 flex-1">
                <span className="font-medium text-ink">{t('reportPage.version', { version: v.version })}</span>{' '}
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        v.status === 'FINAL' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                    )}
                >
                    {v.status === 'FINAL' ? t('reportPage.final') : t('reportPage.draft')}
                </span>{' '}
                <span className="text-xs text-muted-foreground">{v.locale.toUpperCase()}</span>
                <span className="block text-xs text-muted-foreground">
                    {v.status === 'FINAL' && v.signedAt
                        ? t('reportPage.signedBy', { name: v.signer ?? '', date: formatWib(v.signedAt, locale) })
                        : t('reportPage.createdBy', { date: formatWib(v.createdAt, locale) })}
                </span>
            </span>
            <span className="flex flex-wrap gap-1">
                <Button asChild size="sm" variant="ghost">
                    <a href={ReportController.show.url({ assessment, report: v.id })} target="_blank" rel="noopener">
                        <ExternalLink aria-hidden />
                        {t('reportPage.open')}
                    </a>
                </Button>
                {pdfAvailable || v.hasPdf ? (
                    <Button asChild size="sm" variant="ghost">
                        <a href={ReportController.pdf.url({ assessment, report: v.id })} data-testid="report-pdf">
                            <Download aria-hidden />
                            {t('reportPage.pdf')}
                        </a>
                    </Button>
                ) : null}
                {canSign && latest && v.status === 'DRAFT' ? (
                    <Button size="sm" variant="outline" onClick={onSign} data-testid="report-sign">
                        <PenLine aria-hidden />
                        {t('reportPage.sign')}
                    </Button>
                ) : null}
            </span>
        </li>
    );
}

function SignDialog({ version, assessment, onClose }: { version: Version; assessment: string; onClose: () => void }) {
    const t = useT();
    const form = useForm({ position: 'Asesor utama' });
    return (
        <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('reportPage.signTitle', { kind: t(`reportKinds.${version.kind}`), version: version.version })}
                    </DialogTitle>
                    <DialogDescription>{t('reportPage.signHint')}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(ReportController.sign.url({ assessment, report: version.id }), {
                            preserveScroll: true,
                            onSuccess: onClose,
                        });
                    }}
                >
                    <Field id="sign-position" label={t('reportPage.position')} error={form.errors.position}>
                        <Input
                            id="sign-position"
                            required
                            minLength={2}
                            maxLength={200}
                            value={form.data.position}
                            onChange={(e) => form.setData('position', e.target.value)}
                        />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            {t('reportPage.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing} data-testid="sign-confirm">
                            {t('reportPage.confirm')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
