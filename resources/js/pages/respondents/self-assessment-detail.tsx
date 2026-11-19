import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { CollectionShell } from '@/components/nscas/collection-shell';
import type { CollectionCommon } from '@/components/nscas/collection-shell';
import { Panel, formatDateTime } from '@/components/nscas/setup-shell';
import { useLocale, useT } from '@/i18n';

type Detail = {
    id: string;
    name: string;
    position: string;
    unit: string;
    status: 'DRAFT' | 'SUBMITTED';
    submittedAt: string | null;
    rows: {
        code: string;
        name: string;
        level: number | null;
        statement: string | null;
        justification: string | null;
        evidenceCount: number;
    }[];
};

/** Rincian jawaban satu penilaian mandiri, dengan tingkat, pernyataan, alasan, dan jumlah bukti. */
export default function SelfAssessmentDetail(props: CollectionCommon & { detail: Detail; backHref: string }) {
    const t = useT();
    const locale = useLocale();
    const d = props.detail;

    return (
        <CollectionShell module="selfAssessments" common={props} canEdit={false} readOnlyNotice={false}>
            <Link
                href={props.backHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-maroon hover:underline"
            >
                <ArrowLeft aria-hidden className="size-4" />
                {t('selfAssessments.detail.back')}
            </Link>
            <div className="space-y-1">
                <p className="text-lg font-semibold text-ink">
                    {t('selfAssessments.detail.respondent', { name: d.name, position: d.position })}
                </p>
                <p className="text-sm text-muted-foreground">{d.unit}</p>
                <p className="text-sm text-charcoal">
                    {d.status === 'SUBMITTED' && d.submittedAt
                        ? t('selfAssessments.detail.submittedAt', { date: formatDateTime(d.submittedAt, locale) })
                        : t('selfAssessments.detail.draft')}
                </p>
            </div>
            <div className="space-y-4" data-testid="sa-detail">
                {d.rows.map((r) => (
                    <Panel key={r.code} title={`${r.code} ${r.name}`}>
                        {r.level === null ? (
                            <p className="text-sm text-muted-foreground">{t('selfAssessments.detail.noAnswer')}</p>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gold-deep">
                                    {t('selfAssessments.detail.level', { level: r.level })}
                                </p>
                                <p className="text-sm text-ink">{r.statement}</p>
                            </div>
                        )}
                        {r.justification ? (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground">
                                    {t('selfAssessments.detail.justification')}
                                </p>
                                <p className="text-sm whitespace-pre-line text-charcoal">{r.justification}</p>
                            </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                            {t('selfAssessments.detail.evidence')}:{' '}
                            {r.evidenceCount === 0
                                ? t('selfAssessments.detail.noEvidence')
                                : t('selfAssessments.detail.evidenceCount', { count: r.evidenceCount })}
                        </p>
                    </Panel>
                ))}
            </div>
        </CollectionShell>
    );
}
