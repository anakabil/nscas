// Components
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translator, useT } from '@/i18n';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({ status }: { status?: string }) {
    const t = useT();

    return (
        <>
            <Head title={t('auth.forgotPassword.title')} />

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <div className="space-y-6">
                <Form {...email.form()}>
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="email">
                                    {t('auth.fields.email')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="off"
                                    autoFocus
                                    placeholder={t(
                                        'auth.fields.emailPlaceholder',
                                    )}
                                />

                                <InputError message={errors.email} />
                            </div>

                            <div className="my-6 flex items-center justify-start">
                                <Button
                                    className="w-full"
                                    disabled={processing}
                                    data-test="email-password-reset-link-button"
                                >
                                    {processing && (
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                    )}
                                    {t('auth.forgotPassword.submit')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <div className="space-x-1 text-center text-sm text-muted-foreground">
                    <span>{t('auth.forgotPassword.returnTo')}</span>
                    <TextLink href={login()}>
                        {t('auth.forgotPassword.returnLink')}
                    </TextLink>
                </div>
            </div>
        </>
    );
}

// Judul bingkai halaman diterjemahkan dari bahasa halaman (prop bersama `locale`), tanpa hook.
ForgotPassword.layout = ({ locale }: { locale?: string }) => {
    const t = translator(locale === 'en' ? 'en' : 'id');

    return {
        title: t('auth.forgotPassword.title'),
        description: t('auth.forgotPassword.description'),
    };
};
