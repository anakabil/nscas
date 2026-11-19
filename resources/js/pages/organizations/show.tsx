import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Copy, KeyRound, Pencil, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import OrganizationController from '@/actions/App/Http/Controllers/OrganizationController';
import { Container } from '@/components/nscas/parts';
import { Field, FormError, Panel } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useClipboard } from '@/hooks/use-clipboard';
import { useT } from '@/i18n';
import { Chip } from '@/pages/organizations/index';
import type { RoleCode } from '@/types/nscas';

type Organization = {
    id: string;
    name: string;
    legalName: string | null;
    sector: string | null;
    isOperator: boolean;
    isActive: boolean;
};

type UserRow = {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
    roles: RoleCode[];
    twoFactorEnabled: boolean;
    mustChangePassword: boolean;
    isSelf: boolean;
};

type Props = {
    organization: Organization;
    users: UserRow[];
    canManageUsers: boolean;
    canEditOrganization: boolean;
    roleOptions: RoleCode[];
};

type TemporaryPassword = { email: string; password: string; created: boolean };

type SharedProps = {
    flash?: { status?: string | null; temporaryPassword?: TemporaryPassword | null };
    errors?: Record<string, string | undefined>;
};

/** Pilihan peran berupa kotak centang. Tidak ada peran yang terpilih otomatis (PROMPTS.md R1 butir 1). */
function RoleChoices({
    idPrefix,
    options,
    value,
    onChange,
    error,
}: {
    idPrefix: string;
    options: RoleCode[];
    value: RoleCode[];
    onChange: (roles: RoleCode[]) => void;
    error?: string;
}) {
    const t = useT();
    return (
        <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">{t('users.roles')}</legend>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('users.rolesHint')}</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {options.map((role) => {
                    const id = `${idPrefix}-${role}`;
                    return (
                        <label
                            key={role}
                            htmlFor={id}
                            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                        >
                            <Checkbox
                                id={id}
                                className="mt-0.5"
                                checked={value.includes(role)}
                                onCheckedChange={(checked) =>
                                    onChange(checked === true ? [...value, role] : value.filter((r) => r !== role))
                                }
                            />
                            <span className="space-y-0.5">
                                <span className="block font-medium text-foreground">{t(`roles.${role}.name`)}</span>
                                <span className="block text-xs leading-relaxed text-muted-foreground">
                                    {t(`roles.${role}.task`)}
                                </span>
                            </span>
                        </label>
                    );
                })}
            </div>
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </fieldset>
    );
}

/** Ubah data organisasi (hanya pengelola sistem). */
function OrganizationForm({ organization }: { organization: Organization }) {
    const t = useT();
    const form = useForm({
        name: organization.name,
        legal_name: organization.legalName ?? '',
        sector: organization.sector ?? '',
        is_active: organization.isActive,
    });
    const errors = form.errors as Record<string, string | undefined>;
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put(OrganizationController.update.url(organization.id), { preserveScroll: true });
            }}
            data-testid="organization-edit"
        >
            <Panel title={t('organizations.editTitle')}>
                <FormError message={errors.form ?? errors.is_active} />
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
                    {!organization.isOperator ? (
                        <label htmlFor="org-active" className="flex items-center gap-3 self-end pb-2 text-sm text-foreground">
                            <Checkbox
                                id="org-active"
                                checked={form.data.is_active}
                                onCheckedChange={(checked) => form.setData('is_active', checked === true)}
                            />
                            {t('organizations.isActive')}
                        </label>
                    ) : null}
                </div>
                <div className="flex justify-end">
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            </Panel>
        </form>
    );
}

/** Tambah pengguna baru dengan kata sandi sementara. */
function AddUserForm({ organizationId, roleOptions }: { organizationId: string; roleOptions: RoleCode[] }) {
    const t = useT();
    const form = useForm<{ name: string; email: string; roles: RoleCode[] }>({ name: '', email: '', roles: [] });
    const errors = form.errors as Record<string, string | undefined>;
    const rolesError = errors.roles ?? Object.entries(errors).find(([key]) => key.startsWith('roles.'))?.[1];
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(OrganizationController.storeUser.url(organizationId), {
                    preserveScroll: true,
                    onSuccess: () => form.reset(),
                });
            }}
            data-testid="user-create"
        >
            <Panel title={t('users.addTitle')} hint={t('users.addIntro')}>
                <FormError message={errors.form} />
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="new-user-name" label={t('users.name')} error={errors.name}>
                        <Input
                            id="new-user-name"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            autoComplete="off"
                            required
                        />
                    </Field>
                    <Field id="new-user-email" label={t('users.email')} error={errors.email}>
                        <Input
                            id="new-user-email"
                            type="email"
                            value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            autoComplete="off"
                            required
                        />
                    </Field>
                </div>
                <RoleChoices
                    idPrefix="new-user-role"
                    options={roleOptions}
                    value={form.data.roles}
                    onChange={(roles) => form.setData('roles', roles)}
                    error={rolesError}
                />
                <div className="flex justify-end">
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? t('common.saving') : t('users.addSubmit')}
                    </Button>
                </div>
            </Panel>
        </form>
    );
}

/** Ubah nama dan peran satu pengguna di organisasi ini, dalam jendela dialog. */
function EditUserDialog({
    organizationId,
    user,
    roleOptions,
    onClose,
}: {
    organizationId: string;
    user: UserRow;
    roleOptions: RoleCode[];
    onClose: () => void;
}) {
    const t = useT();
    const form = useForm<{ name: string; roles: RoleCode[] }>({ name: user.name, roles: user.roles });
    const errors = form.errors as Record<string, string | undefined>;
    const rolesError = errors.roles ?? Object.entries(errors).find(([key]) => key.startsWith('roles.'))?.[1];
    // Peran yang dipegang tetapi di luar pilihan pelaku tetap ditampilkan agar tidak hilang diam-diam.
    const options = [...roleOptions, ...user.roles.filter((role) => !roleOptions.includes(role))];
    return (
        <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put(OrganizationController.updateUser.url({ organization: organizationId, user: user.id }), {
                            preserveScroll: true,
                            onSuccess: onClose,
                        });
                    }}
                    className="space-y-5"
                    data-testid="user-edit"
                >
                    <DialogHeader>
                        <DialogTitle>{t('users.editTitle')}</DialogTitle>
                        <DialogDescription>{user.email}</DialogDescription>
                    </DialogHeader>
                    <FormError message={errors.form} />
                    <Field id={`edit-user-name-${user.id}`} label={t('users.name')} error={errors.name}>
                        <Input
                            id={`edit-user-name-${user.id}`}
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            required
                        />
                    </Field>
                    <RoleChoices
                        idPrefix={`edit-user-role-${user.id}`}
                        options={options}
                        value={form.data.roles}
                        onChange={(roles) => form.setData('roles', roles)}
                        error={rolesError}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing ? t('common.saving') : t('common.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Kata sandi sementara yang hanya ditampilkan sekali setelah akun dibuat atau diatur ulang. */
function TemporaryPasswordDialog({ value, onClose }: { value: TemporaryPassword; onClose: () => void }) {
    const t = useT();
    const [copied, copy] = useClipboard();
    return (
        <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
            <DialogContent data-testid="temporary-password">
                <DialogHeader>
                    <DialogTitle>{value.created ? t('users.tempTitleCreated') : t('users.tempTitleReset')}</DialogTitle>
                    <DialogDescription>{t('users.tempBody', { email: value.email })}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <code
                        className="flex-1 rounded-md border border-border bg-parchment px-4 py-3 font-mono text-base tracking-wider break-all text-ink select-all"
                        data-testid="temporary-password-value"
                    >
                        {value.password}
                    </code>
                    <Button type="button" variant="outline" onClick={() => void copy(value.password)}>
                        <Copy aria-hidden className="size-4" />
                        {copied === value.password ? t('users.copied') : t('users.copy')}
                    </Button>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        {t('users.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Rincian organisasi beserta pengguna dan perannya (fase R1). */
export default function OrganizationShow({ organization, users, canManageUsers, canEditOrganization, roleOptions }: Props) {
    const t = useT();
    const { flash, errors } = usePage<SharedProps>().props;
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [dismissedPassword, setDismissedPassword] = useState<string | null>(null);
    const temporary = flash?.temporaryPassword ?? null;
    const showTemporary = temporary !== null && temporary.password !== dismissedPassword;
    const pageError = errors?.user ?? errors?.form;

    const toggleActive = (user: UserRow) => {
        if (user.isActive && !window.confirm(t('users.confirmDeactivate', { name: user.name }))) {
            return;
        }
        router.put(
            OrganizationController.setActive.url({ organization: organization.id, user: user.id }),
            { active: !user.isActive },
            { preserveScroll: true },
        );
    };

    const resetPassword = (user: UserRow) => {
        if (!window.confirm(t('users.confirmReset', { name: user.name }))) {
            return;
        }
        router.post(
            OrganizationController.resetPassword.url({ organization: organization.id, user: user.id }),
            {},
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={organization.name} />
            <Container className="space-y-8 py-10">
                <Link
                    href={OrganizationController.index.url()}
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-ink"
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    {t('organizations.back')}
                </Link>
                <header className="space-y-3">
                    <p className="eyebrow text-gold-deep">{t('organizations.title')}</p>
                    <h1 className="font-display text-[2.25rem] leading-tight break-words text-ink sm:text-[2.6rem]">
                        {organization.name}
                    </h1>
                    {organization.legalName ? <p className="text-sm text-muted-foreground">{organization.legalName}</p> : null}
                    <div className="flex flex-wrap gap-2">
                        <Chip tone={organization.isOperator ? 'brand' : 'neutral'}>
                            {organization.isOperator ? t('organizations.operator') : t('organizations.client')}
                        </Chip>
                        <Chip tone={organization.isActive ? 'success' : 'muted'}>
                            {organization.isActive ? t('organizations.active') : t('organizations.inactive')}
                        </Chip>
                        {organization.sector ? <Chip tone="muted">{organization.sector}</Chip> : null}
                    </div>
                </header>
                <div className="hairline-taupe" />

                {flash?.status && ['saved', 'created'].includes(flash.status) ? (
                    <p role="status" className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                        {t(`flash.${flash.status}`)}
                    </p>
                ) : null}

                {!canManageUsers && !canEditOrganization ? (
                    <p role="note" className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
                        {t('organizations.readOnly')}
                    </p>
                ) : null}

                {canEditOrganization ? <OrganizationForm organization={organization} /> : null}

                <Panel title={t('users.title')}>
                    <FormError message={pageError} />
                    {users.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid="users-empty">
                            {t('users.empty')}
                        </p>
                    ) : (
                        <div className="-mx-2 overflow-x-auto px-2">
                            <table className="w-full min-w-[40rem] text-left text-sm" data-testid="users-table">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground">
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('users.name')}
                                        </th>
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('users.roles')}
                                        </th>
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('users.status')}
                                        </th>
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            {t('users.twoStep')}
                                        </th>
                                        {canManageUsers ? (
                                            <th scope="col" className="py-2 font-medium">
                                                <span className="sr-only">{t('common.edit')}</span>
                                            </th>
                                        ) : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="border-b border-border/70 align-top last:border-0"
                                            data-user={user.email}
                                        >
                                            <td className="py-3 pr-4">
                                                <p className="font-medium text-foreground">
                                                    {user.name}
                                                    {user.isSelf ? (
                                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                            ({t('users.you')})
                                                        </span>
                                                    ) : null}
                                                </p>
                                                <p className="text-xs break-all text-muted-foreground">{user.email}</p>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <ul className="space-y-0.5">
                                                    {user.roles.map((role) => (
                                                        <li key={role}>{t(`roles.${role}.name`)}</li>
                                                    ))}
                                                </ul>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <Chip tone={user.isActive ? 'success' : 'muted'}>
                                                        {user.isActive ? t('users.active') : t('users.inactive')}
                                                    </Chip>
                                                    {user.mustChangePassword ? (
                                                        <Chip tone="brand">{t('users.mustChange')}</Chip>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4">
                                                {user.twoFactorEnabled ? t('users.twoStepOn') : t('users.twoStepOff')}
                                            </td>
                                            {canManageUsers ? (
                                                <td className="py-3">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setEditing(user)}
                                                        >
                                                            <Pencil aria-hidden className="size-3.5" />
                                                            {t('common.edit')}
                                                        </Button>
                                                        {!user.isSelf ? (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => toggleActive(user)}
                                                            >
                                                                {user.isActive ? (
                                                                    <PowerOff aria-hidden className="size-3.5" />
                                                                ) : (
                                                                    <Power aria-hidden className="size-3.5" />
                                                                )}
                                                                {user.isActive ? t('users.deactivate') : t('users.activate')}
                                                            </Button>
                                                        ) : null}
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => resetPassword(user)}
                                                        >
                                                            <KeyRound aria-hidden className="size-3.5" />
                                                            {t('users.resetPassword')}
                                                        </Button>
                                                    </div>
                                                </td>
                                            ) : null}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>

                {canManageUsers ? <AddUserForm organizationId={organization.id} roleOptions={roleOptions} /> : null}
            </Container>

            {editing ? (
                <EditUserDialog
                    key={editing.id}
                    organizationId={organization.id}
                    user={editing}
                    roleOptions={roleOptions}
                    onClose={() => setEditing(null)}
                />
            ) : null}

            {showTemporary && temporary ? (
                <TemporaryPasswordDialog value={temporary} onClose={() => setDismissedPassword(temporary.password)} />
            ) : null}
        </>
    );
}
