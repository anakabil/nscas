import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Building2 } from 'lucide-react';
import OrganizationController from '@/actions/App/Http/Controllers/OrganizationController';
import { Container } from '@/components/nscas/parts';
import { Field, FormError, Panel } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

type OrganizationRow = {
    id: string;
    name: string;
    legalName: string | null;
    sector: string | null;
    isOperator: boolean;
    isActive: boolean;
    userCount: number;
    assessmentCount: number;
    href: string;
};

type Props = { organizations: OrganizationRow[]; canCreate: boolean };

/** Penanda kecil berbingkai, misalnya jenis atau status organisasi. */
export function Chip({
    tone = 'neutral',
    children,
}: {
    tone?: 'neutral' | 'brand' | 'success' | 'muted';
    children: React.ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
                tone === 'brand' && 'border-maroon/30 bg-maroon-soft text-maroon',
                tone === 'success' && 'border-success/30 bg-success/10 text-success',
                tone === 'muted' && 'border-border bg-muted text-muted-foreground',
                tone === 'neutral' && 'border-border bg-card text-foreground',
            )}
        >
            {children}
        </span>
    );
}

/** Daftar organisasi dan pengguna (fase R1). Organisasi pelaksana tampil paling atas. */
export default function OrganizationsIndex({ organizations, canCreate }: Props) {
    const t = useT();
    const locale = useLocale();
    const number = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'id-ID');
    const form = useForm({ name: '', legal_name: '', sector: '' });
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <>
            <Head title={t('organizations.title')} />
            <Container className="space-y-8 py-10">
                <header className="space-y-2">
                    <h1 className="font-display text-[2.25rem] leading-tight text-ink sm:text-[2.6rem]">
                        {t('organizations.title')}
                    </h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">{t('organizations.intro')}</p>
                </header>
                <div className="hairline-taupe" />

                {organizations.length === 0 ? (
                    <p
                        className="frame-hairline rounded-lg p-8 text-center text-sm text-muted-foreground"
                        data-testid="organizations-empty"
                    >
                        {t('organizations.empty')}
                    </p>
                ) : (
                    <ul className="grid gap-4 lg:grid-cols-2" data-testid="organizations-list">
                        {organizations.map((organization) => (
                            <li key={organization.id}>
                                <Link
                                    href={organization.href}
                                    className="group frame-hairline flex h-full flex-col gap-4 rounded-lg p-6 transition-shadow hover:shadow-[0_18px_40px_-28px_rgb(26_26_26/0.5)]"
                                >
                                    <div className="flex items-start gap-4">
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'flex size-11 shrink-0 items-center justify-center rounded-lg',
                                                organization.isOperator ? 'bg-maroon text-parchment' : 'bg-muted text-maroon',
                                            )}
                                        >
                                            <Building2 className="size-5" strokeWidth={1.5} />
                                        </span>
                                        <div className="min-w-0 space-y-1">
                                            <p className="font-display text-[1.35rem] leading-snug break-words text-ink">
                                                {organization.name}
                                            </p>
                                            {organization.legalName ? (
                                                <p className="text-sm break-words text-muted-foreground">
                                                    {organization.legalName}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Chip tone={organization.isOperator ? 'brand' : 'neutral'}>
                                            {organization.isOperator ? t('organizations.operator') : t('organizations.client')}
                                        </Chip>
                                        <Chip tone={organization.isActive ? 'success' : 'muted'}>
                                            {organization.isActive ? t('organizations.active') : t('organizations.inactive')}
                                        </Chip>
                                        {organization.sector ? <Chip tone="muted">{organization.sector}</Chip> : null}
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('organizations.users')}</dt>
                                            <dd className="numeral font-semibold">{number.format(organization.userCount)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('organizations.assessments')}</dt>
                                            <dd className="numeral font-semibold">
                                                {number.format(organization.assessmentCount)}
                                            </dd>
                                        </div>
                                    </dl>
                                    <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-ink">
                                        {t('organizations.open')}
                                        <ArrowRight
                                            aria-hidden
                                            className="size-4 transition-transform group-hover:translate-x-0.5"
                                        />
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}

                {canCreate ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post(OrganizationController.store.url(), { preserveScroll: true });
                        }}
                        data-testid="organization-create"
                    >
                        <Panel title={t('organizations.createTitle')}>
                            <FormError message={errors.form} />
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field id="org-name" label={t('organizations.name')} error={errors.name}>
                                    <Input
                                        id="org-name"
                                        value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)}
                                        required
                                    />
                                </Field>
                                <Field id="org-legal-name" label={t('organizations.legalName')} error={errors.legal_name}>
                                    <Input
                                        id="org-legal-name"
                                        value={form.data.legal_name}
                                        onChange={(e) => form.setData('legal_name', e.target.value)}
                                    />
                                </Field>
                                <Field id="org-sector" label={t('organizations.sector')} error={errors.sector}>
                                    <Input
                                        id="org-sector"
                                        value={form.data.sector}
                                        onChange={(e) => form.setData('sector', e.target.value)}
                                    />
                                </Field>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={form.processing}>
                                    {form.processing ? t('common.saving') : t('organizations.createSubmit')}
                                </Button>
                            </div>
                        </Panel>
                    </form>
                ) : null}
            </Container>
        </>
    );
}
