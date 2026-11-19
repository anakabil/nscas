import { router, useForm } from '@inertiajs/react';
import { Printer, QrCode, XCircle } from 'lucide-react';
import QrController from '@/actions/App/Http/Controllers/Respondents/QrController';
import { CollectionShell, formatWib } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Field, NativeSelect, Panel, formatDateTime, formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Translate } from '@/i18n';
import { useLocale, useT } from '@/i18n';

type Code = { id: string; unit: string; stratum: string | null; createdAt: string; issued: number; maxIssuance: number | null };
type Created = { id: string; link: string; unit: string; stratum: string | null; svg: string };
type Props = CollectionCommon & {
    canEdit: boolean;
    units: { id: string; name: string; depth: number }[];
    strata: { id: string; code: string; name: string }[];
    codes: Code[];
    created: Created | null;
};

function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
    );
}

/**
 * Lembar A4 untuk ditempel di lokasi kerja, dibuka di jendela baru lalu dicetak. Tanpa skrip dan tanpa sumber luar;
 * kode QR berupa SVG yang dibuat server.
 */
function printSheet(created: Created, t: Translate, closesAt: string | null, locale: 'id' | 'en') {
    const w = window.open('', '_blank', 'width=820,height=1100');
    if (!w) {
        return;
    }
    const line = (text: string) => `<p>${escapeHtml(text)}</p>`;
    w.document
        .write(`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>${escapeHtml(t('qrCodes.sheet.heading'))}</title>
<style>
@page { size: A4; margin: 18mm; }
body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; text-align: center; margin: 0; }
h1 { color: #691b2e; font-size: 26px; line-height: 1.3; margin: 0 0 10px; }
.unit { font-size: 20px; font-weight: bold; margin: 0 0 18px; }
.qr { width: 120mm; height: 120mm; margin: 0 auto 14px; }
.qr svg { width: 100%; height: 100%; }
p { font-size: 15px; line-height: 1.5; margin: 0 0 8px; }
.url { font-family: monospace; font-size: 12px; word-break: break-all; }
footer { margin-top: 18px; color: #86652a; font-size: 13px; letter-spacing: 0.08em; }
</style></head><body>
<h1>${escapeHtml(t('qrCodes.sheet.heading'))}</h1>
<p class="unit">${escapeHtml(t('qrCodes.sheet.unit'))}: ${escapeHtml(created.unit)}${created.stratum ? ` · ${escapeHtml(t('qrCodes.sheet.stratum'))}: ${escapeHtml(created.stratum)}` : ''}</p>
<div class="qr">${created.svg.replace(/<\?xml[^>]*>/, '')}</div>
${line(t('qrCodes.sheet.scan'))}
${line(t('qrCodes.sheet.anonymous'))}
${line(t('qrCodes.sheet.duration'))}
${closesAt ? line(t('qrCodes.sheet.closes', { date: formatWib(closesAt, locale) })) : ''}
${line(t('qrCodes.sheet.manual'))}
<p class="url">${escapeHtml(created.link)}</p>
<footer>${escapeHtml(t('qrCodes.sheet.footer'))}</footer>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
}

/** Kode QR unit (tahap 2, docs/01 M2). */
export default function RespondentsQr(props: Props) {
    const t = useT();
    const locale = useLocale();
    const form = useForm({ unit_id: '', stratum_id: '', max_issuance: '' });
    const assessment = props.assessment.id;

    return (
        <CollectionShell module="qr" common={props} canEdit={props.canEdit}>
            <div className="max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>{t('qrCodes.intro')}</p>
                <p>{t('qrCodes.openNote')}</p>
            </div>

            {props.created ? (
                <Panel title={t('qrCodes.printReady', { unit: props.created.unit })} className="border-gold/60">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                        <div
                            className="size-44 shrink-0 rounded-md border border-border bg-white p-2 [&_svg]:size-full"
                            // SVG dibuat server dari tautan kode QR (BaconQrCode), bukan dari isian pengguna.
                            dangerouslySetInnerHTML={{ __html: props.created.svg.replace(/<\?xml[^>]*>/, '') }}
                        />
                        <div className="min-w-0 space-y-3">
                            <code className="block text-xs break-all text-charcoal">{props.created.link}</code>
                            <Button
                                type="button"
                                onClick={() => printSheet(props.created as Created, t, props.window.closesAt, locale)}
                            >
                                <Printer aria-hidden />
                                {t('qrCodes.print')}
                            </Button>
                            <p className="text-xs text-muted-foreground">{t('qrCodes.rotateNote')}</p>
                        </div>
                    </div>
                </Panel>
            ) : null}

            {props.canEdit ? (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.transform((d) => ({
                            unit_id: d.unit_id,
                            stratum_id: d.stratum_id === '' ? null : d.stratum_id,
                            max_issuance: d.max_issuance === '' ? null : Number(d.max_issuance),
                        }));
                        form.post(QrController.store.url(assessment), { preserveScroll: true, onSuccess: () => form.reset() });
                    }}
                >
                    <Panel title={t('qrCodes.create')} hint={t('qrCodes.rotateNote')}>
                        <div className="grid gap-5 sm:grid-cols-3">
                            <Field id="qr-unit" label={t('qrCodes.unit')} error={form.errors.unit_id}>
                                <NativeSelect
                                    id="qr-unit"
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
                            <Field id="qr-stratum" label={t('qrCodes.stratum')} error={form.errors.stratum_id}>
                                <NativeSelect
                                    id="qr-stratum"
                                    value={form.data.stratum_id}
                                    onChange={(e) => form.setData('stratum_id', e.target.value)}
                                >
                                    <option value="">{t('qrCodes.stratumAny')}</option>
                                    {props.strata.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.code} · {s.name}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field
                                id="qr-max"
                                label={t('qrCodes.maxIssuance')}
                                hint={t('qrCodes.maxIssuanceHint')}
                                error={form.errors.max_issuance}
                            >
                                <Input
                                    id="qr-max"
                                    type="number"
                                    min={1}
                                    max={100000}
                                    inputMode="numeric"
                                    value={form.data.max_issuance}
                                    onChange={(e) => form.setData('max_issuance', e.target.value)}
                                />
                            </Field>
                        </div>
                        <Button type="submit" disabled={form.processing}>
                            <QrCode aria-hidden />
                            {form.processing ? t('qrCodes.creating') : t('qrCodes.create')}
                        </Button>
                    </Panel>
                </form>
            ) : null}

            <Panel title={t('qrCodes.activeTitle')}>
                {props.codes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('qrCodes.none')}</p>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-left text-sm" data-testid="qr-codes">
                            <thead className="border-b border-border text-xs text-muted-foreground">
                                <tr>
                                    <th className="py-2 pr-3">{t('qrCodes.unit')}</th>
                                    <th className="py-2 pr-3">{t('qrCodes.stratum')}</th>
                                    <th className="py-2 pr-3">{t('qrCodes.created')}</th>
                                    <th className="py-2 pr-3 text-right">{t('qrCodes.issued')}</th>
                                    <th className="py-2 pr-3 text-right">{t('qrCodes.limit')}</th>
                                    {props.canEdit ? <th className="py-2" /> : null}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {props.codes.map((c) => (
                                    <tr key={c.id}>
                                        <td className="py-2 pr-3 font-medium text-ink">{c.unit}</td>
                                        <td className="py-2 pr-3">{c.stratum ?? t('qrCodes.stratumAny')}</td>
                                        <td className="py-2 pr-3">{formatDateTime(c.createdAt, locale)}</td>
                                        <td className="numeral py-2 pr-3 text-right">{formatNumber(c.issued, locale)}</td>
                                        <td className="numeral py-2 pr-3 text-right">
                                            {c.maxIssuance === null ? t('qrCodes.noLimit') : formatNumber(c.maxIssuance, locale)}
                                        </td>
                                        {props.canEdit ? (
                                            <td className="py-2 text-right">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        if (window.confirm(t('qrCodes.confirmDeactivate'))) {
                                                            router.delete(QrController.destroy.url({ assessment, code: c.id }), {
                                                                preserveScroll: true,
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <XCircle aria-hidden />
                                                    {t('qrCodes.deactivate')}
                                                </Button>
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </CollectionShell>
    );
}
