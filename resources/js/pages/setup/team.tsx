import { router, useForm } from '@inertiajs/react';
import { UserMinus } from 'lucide-react';
import TeamController from '@/actions/App/Http/Controllers/Setup/TeamController';
import { Field, FormError, NativeSelect, Panel, SetupShell } from '@/components/nscas/setup-shell';
import type { SetupCommon } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';

type Member = { id: number; userId: number; name: string; email: string; role: string; active: boolean };
type Staff = { id: number; name: string; email: string; canLead: boolean };

type Props = SetupCommon & { members: Member[]; staff: Staff[] };

/** Halaman tim asesor (tahap 1). Diubah oleh asesor utama atau pengelola sistem sampai asesmen ditutup. */
export default function SetupTeam(props: Props) {
    const t = useT();
    const form = useForm({ user_id: '', role: 'ASSESSOR' });
    const errors = form.errors as Record<string, string | undefined>;
    const chosen = props.staff.find((s) => String(s.id) === form.data.user_id);
    const leads = props.members.filter((m) => m.role === 'LEAD_ASSESSOR').length;

    const remove = (member: Member) => {
        if (window.confirm(t('team.confirmRemove', { name: member.name }))) {
            router.delete(TeamController.destroy.url({ assessment: props.assessment.id, member: member.id }), {
                preserveScroll: true,
            });
        }
    };

    return (
        <SetupShell module="team" common={props}>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('team.intro')}</p>
            <Panel>
                <FormError message={errors.member} />
                {props.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('team.empty')}</p>
                ) : (
                    <ul className="divide-y divide-border" data-testid="team-list">
                        {props.members.map((member) => (
                            <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-ink">{member.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                                </div>
                                <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-charcoal">
                                    {t(`roles.${member.role}.name`)}
                                </span>
                                {!member.active ? <span className="text-xs text-destructive">{t('team.inactive')}</span> : null}
                                {props.canEdit && !(member.role === 'LEAD_ASSESSOR' && leads <= 1) ? (
                                    <Button type="button" size="sm" variant="ghost" onClick={() => remove(member)}>
                                        <UserMinus aria-hidden />
                                        {t('team.remove')}
                                    </Button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-xs text-muted-foreground">{t('team.minimum', { count: props.members.length })}</p>
            </Panel>

            {props.canEdit ? (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.transform((data) => ({ ...data, user_id: Number(data.user_id) }));
                        form.post(TeamController.store.url(props.assessment.id), {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                >
                    <Panel title={t('team.addTitle')} hint={t('team.calibrationNote')}>
                        {props.staff.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('team.noStaff')}</p>
                        ) : (
                            <>
                                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
                                    <Field id="team-user" label={t('team.staff')} error={errors.user_id}>
                                        <NativeSelect
                                            id="team-user"
                                            value={form.data.user_id}
                                            onChange={(e) => {
                                                const next = props.staff.find((s) => String(s.id) === e.target.value);
                                                form.setData({
                                                    user_id: e.target.value,
                                                    role: next && !next.canLead ? 'ASSESSOR' : form.data.role,
                                                });
                                            }}
                                            required
                                        >
                                            <option value="">{t('team.chooseStaff')}</option>
                                            {props.staff.map((staff) => (
                                                <option key={staff.id} value={staff.id}>
                                                    {`${staff.name} (${staff.email})`}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                    <Field id="team-role" label={t('team.role')} error={errors.role}>
                                        <NativeSelect
                                            id="team-role"
                                            value={form.data.role}
                                            onChange={(e) => form.setData('role', e.target.value)}
                                        >
                                            <option value="ASSESSOR">{t('roles.ASSESSOR.name')}</option>
                                            {!chosen || chosen.canLead ? (
                                                <option value="LEAD_ASSESSOR">{t('roles.LEAD_ASSESSOR.name')}</option>
                                            ) : null}
                                        </NativeSelect>
                                    </Field>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={form.processing || form.data.user_id === ''}>
                                        {form.processing ? t('common.saving') : t('team.add')}
                                    </Button>
                                </div>
                            </>
                        )}
                    </Panel>
                </form>
            ) : null}
        </SetupShell>
    );
}
