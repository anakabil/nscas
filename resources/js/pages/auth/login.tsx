import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { translator, useT } from '@/i18n';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

// Status sesi berakhir dikirim sebagai kunci oleh EnforceSessionLimits; status lain sudah berupa kalimat.
const SESSION_STATUS = ['sessionExpired', 'sessionIdle'];

export default function Login({ status, canResetPassword }: Props) {
    const t = useT();
    const sessionEnded = status !== undefined && SESSION_STATUS.includes(status);

    return (
        <>
            <Head title={t('auth.login.title')} />

            <Form {...store.form()} resetOnSuccess={['password']} className="flex flex-col gap-6">
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">{t('auth.fields.email')}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder={t('auth.fields.emailPlaceholder')}
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">{t('auth.fields.password')}</Label>
                                    {canResetPassword && (
                                        <TextLink href={request()} className="ml-auto text-sm" tabIndex={5}>
                                            {t('auth.login.forgotPassword')}
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder={t('auth.fields.password')}
                                />
                                <InputError message={errors.password} />
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                {t('auth.login.submit')}
                            </Button>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <div
                    role="status"
                    className={
                        sessionEnded
                            ? 'mb-4 rounded-md border border-gold/50 bg-gold/10 px-3 py-2 text-center text-sm text-ink'
                            : 'mb-4 text-center text-sm font-medium text-green-600'
                    }
                    data-testid="login-status"
                >
                    {sessionEnded ? t(`auth.login.${status}`) : status}
                </div>
            )}
        </>
    );
}

// Judul bingkai halaman diterjemahkan dari bahasa halaman (prop bersama `locale`), tanpa hook.
Login.layout = ({ locale }: { locale?: string }) => {
    const t = translator(locale === 'en' ? 'en' : 'id');

    return {
        title: t('auth.login.heading'),
        description: t('auth.login.description'),
    };
};
