import { Link, router, useForm } from '@inertiajs/react';
import { Copy, Eye, Mail, RotateCcw, ShieldOff, UserPlus } from 'lucide-react';
import { useState } from 'react';
import SelfAssessmentController from '@/actions/App/Http/Controllers/Respondents/SelfAssessmentController';
import { CollectionShell } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, NativeSelect, Panel, formatDateTime } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';

type Row = {
    id: string;
    name: string;
    position: string;
    unit: string;
    status: 'NOT_OPENED' | 'DRAFT' | 'SUBMITTED' | 'REVOKED';
    issuedAt: string;
    submittedAt: string | null;
    answered: number;
    total: number;
    emailed: boolean;
};

type Props = CollectionCommon & {
    canEdit: boolean;
    units: { id: string; name: string; depth: number }[];
    rows: Row[];
    issued: { name: string; link: string } | null;
};

/** Penilaian mandiri manajemen (tahap 2, docs/01 M4). Teridentifikasi; tautan diterbitkan administrator klien. */
export default function SelfAssessments(props: Props) {
    const t = useT();
    const locale = useLocale();
    const assessment = props.assessment.id;
    const form = useForm({ name: '', position: '', unit_id: '' });
    const [copied, setCopied] = useState(false);
    const [emailFor, setEmailFor] = useState<Row | null>(null);

    return (
        <CollectionShell module="selfAssessments" common={props} canEdit={props.canEdit}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('selfAssessments.intro')}</p>

            {props.issued ? (
                <Panel title={t('selfAssessments.issue.issued', { name: props.issued.name })} className="border-gold/60">
                    <div className="flex flex-wrap items-center gap-3" data-testid="sa-issued">
                        <code className="max-w-full text-xs break-all text-charcoal">{props.issued.link}</code>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                void navigator.clipboard?.writeText(props.issued?.link ?? '');
                                setCopied(true);
                            }}
                        >
                            <Copy aria-hidden />
                            {copied ? t('selfAssessments.issue.copied') : t('selfAssessments.issue.copy')}
                        </Button>
                    </div>
                </Panel>
            ) : null}

            {props.canEdit ? (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(SelfAssessmentController.store.url(assessment), {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                >
                    <Panel title={t('selfAssessments.issue.title')}>
                        <div className="grid gap-5 sm:grid-cols-3">
                            <Field id="sa-name" label={t('selfAssessments.issue.name')} error={form.errors.name}>
                                <Input
                                    id="sa-name"
                                    required
                                    minLength={2}
                                    maxLength={200}
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                />
                            </Field>
                            <Field id="sa-position" label={t('selfAssessments.issue.position')} error={form.errors.position}>
                                <Input
                                    id="sa-position"
                                    required
                                    minLength={2}
                                    maxLength={200}
                                    value={form.data.position}
                                    onChange={(e) => form.setData('position', e.target.value)}
                                />
                            </Field>
                            <Field id="sa-unit" label={t('selfAssessments.issue.unit')} error={form.errors.unit_id}>
                                <NativeSelect
                                    id="sa-unit"
                                    required
                                    value={form.data.unit_id}
                                    onChange={(e) => form.setData('unit_id', e.target.value)}
                                >
                                    <option value="" />
                                    {props.units.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {'  '.repeat(u.depth)}
                                            {u.name}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                        </div>
                        <Button type="submit" disabled={form.processing}>
                            <UserPlus aria-hidden />
                            {t('selfAssessments.issue.submit')}
                        </Button>
                    </Panel>
                </form>
            ) : null}

            <Panel title={t('selfAssessments.table.title')}>
                {props.rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('selfAssessments.table.empty')}</p>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[52rem] text-left text-sm" data-testid="sa-table">
                            <thead className="border-b border-border text-xs text-muted-foreground">
                                <tr>
                                    <th className="py-2 pr-3">{t('selfAssessments.table.name')}</th>
                                    <th className="py-2 pr-3">{t('selfAssessments.table.unit')}</th>
                                    <th className="py-2 pr-3">{t('selfAssessments.table.status')}</th>
                                    <th className="py-2 pr-3">{t('selfAssessments.table.progress')}</th>
                                    <th className="py-2 pr-3">{t('selfAssessments.table.issuedAt')}</th>
                                    <th className="py-2">{t('selfAssessments.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {props.rows.map((r) => (
                                    <tr key={r.id}>
                                        <td className="py-2 pr-3">
                                            <p className="font-medium text-ink">{r.name}</p>
                                            <p className="text-xs text-muted-foreground">{r.position}</p>
                                        </td>
                                        <td className="py-2 pr-3">{r.unit}</td>
                                        <td
                                            className={`py-2 pr-3 ${r.status === 'SUBMITTED' ? 'text-success' : r.status === 'REVOKED' ? 'text-destructive' : ''}`}
                                        >
                                            {t(`selfAssessments.table.statuses.${r.status}`)}
                                            {r.emailed ? (
                                                <span className="block text-xs text-muted-foreground">
                                                    {t('selfAssessments.table.emailed')}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="numeral py-2 pr-3">
                                            {t('selfAssessments.table.progressValue', { count: r.answered, total: r.total })}
                                        </td>
                                        <td className="py-2 pr-3">{formatDateTime(r.issuedAt, locale)}</td>
                                        <td className="py-2">
                                            <div className="flex gap-1 whitespace-nowrap">
                                                <Button asChild size="sm" variant="ghost">
                                                    <Link
                                                        href={SelfAssessmentController.show.url({
                                                            assessment,
                                                            selfAssessment: r.id,
                                                        })}
                                                    >
                                                        <Eye aria-hidden />
                                                        {t('selfAssessments.table.view')}
                                                    </Link>
                                                </Button>
                                                {props.canEdit && r.status !== 'SUBMITTED' ? (
                                                    <>
                                                        {r.status !== 'REVOKED' ? (
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="size-8"
                                                                aria-label={t('selfAssessments.table.revoke')}
                                                                title={t('selfAssessments.table.revoke')}
                                                                onClick={() => {
                                                                    if (
                                                                        window.confirm(t('selfAssessments.table.confirmRevoke'))
                                                                    ) {
                                                                        router.post(
                                                                            SelfAssessmentController.revoke.url({
                                                                                assessment,
                                                                                selfAssessment: r.id,
                                                                            }),
                                                                            {},
                                                                            { preserveScroll: true },
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                <ShieldOff aria-hidden />
                                                            </Button>
                                                        ) : null}
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8"
                                                            aria-label={t('selfAssessments.table.email')}
                                                            title={t('selfAssessments.table.email')}
                                                            data-testid="sa-email"
                                                            onClick={() => setEmailFor(r)}
                                                        >
                                                            <Mail aria-hidden />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8"
                                                            aria-label={t('selfAssessments.table.reissue')}
                                                            title={t('selfAssessments.table.reissue')}
                                                            onClick={() =>
                                                                router.post(
                                                                    SelfAssessmentController.reissue.url({
                                                                        assessment,
                                                                        selfAssessment: r.id,
                                                                    }),
                                                                    {},
                                                                    { preserveScroll: true },
                                                                )
                                                            }
                                                        >
                                                            <RotateCcw aria-hidden />
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
            {emailFor ? <EmailDialog assessment={assessment} row={emailFor} onClose={() => setEmailFor(null)} /> : null}
        </CollectionShell>
    );
}

/** Mengirim tautan baru lewat surel (keputusan R4); tautan lama berhenti berlaku saat surel terkirim. */
function EmailDialog({ assessment, row, onClose }: { assessment: string; row: Row; onClose: () => void }) {
    const t = useT();
    const form = useForm({ email: '' });
    return (
        <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('selfAssessments.email.title', { name: row.name })}</DialogTitle>
                    <DialogDescription>{t('selfAssessments.email.hint')}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(SelfAssessmentController.email.url({ assessment, selfAssessment: row.id }), {
                            preserveScroll: true,
                            onSuccess: onClose,
                        });
                    }}
                >
                    <Field id="sa-email" label={t('selfAssessments.email.address')} error={form.errors.email}>
                        <Input
                            id="sa-email"
                            type="email"
                            required
                            autoComplete="off"
                            maxLength={254}
                            value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                        />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            {t('selfAssessments.email.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            <Mail aria-hidden />
                            {t('selfAssessments.email.send')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
