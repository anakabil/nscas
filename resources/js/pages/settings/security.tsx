import { Form, Head } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';
import { useRef } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { translator, useT } from '@/i18n';
import { edit } from '@/routes/security';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import ManageTwoFactor from '@/components/manage-two-factor';

// oxfmt-ignore
type Props = {
    passwordRules: string;
    /** Peran pengguna mewajibkan verifikasi dua langkah dan belum diaktifkan (dihitung di server). */
    twoFactorRequired?: boolean;
} &
    ManageTwoFactorProps;

export default function Security(props: Props) {
    const t = useT();
    const twoFactorRequired = props.twoFactorRequired === true;
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <>
            <Head title={t('settings.security.title')} />

            <h1 className="sr-only">{t('settings.security.title')}</h1>

            {twoFactorRequired && (
                <Alert>
                    <ShieldAlert aria-hidden="true" />
                    <AlertDescription className="text-foreground">{t('settings.twoFactorRequired')}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('settings.password.heading')}
                    description={t('settings.password.description')}
                />

                <Form
                    {...SecurityController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    resetOnError={['password', 'password_confirmation', 'current_password']}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="current_password">{t('settings.password.current')}</Label>

                                <PasswordInput
                                    id="current_password"
                                    ref={currentPasswordInput}
                                    name="current_password"
                                    className="mt-1 block w-full"
                                    autoComplete="current-password"
                                    placeholder={t('settings.password.current')}
                                />

                                <InputError message={errors.current_password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">{t('settings.password.new')}</Label>

                                <PasswordInput
                                    id="password"
                                    ref={passwordInput}
                                    name="password"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder={t('settings.password.new')}
                                    passwordrules={props.passwordRules}
                                />

                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">{t('settings.password.confirmation')}</Label>

                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder={t('settings.password.confirmation')}
                                    passwordrules={props.passwordRules}
                                />

                                <InputError message={errors.password_confirmation} />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button disabled={processing} data-test="update-password-button">
                                    {t('settings.save')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>

            <ManageTwoFactor
                canManageTwoFactor={props.canManageTwoFactor}
                requiresConfirmation={props.requiresConfirmation}
                twoFactorEnabled={props.twoFactorEnabled}
            />
        </>
    );
}

// Judul remah roti diterjemahkan dari bahasa halaman (prop bersama `locale`), tanpa hook.
Security.layout = ({ locale }: { locale?: string }) => {
    const t = translator(locale === 'en' ? 'en' : 'id');

    return {
        breadcrumbs: [
            {
                title: t('settings.security.title'),
                href: edit(),
            },
        ],
    };
};
