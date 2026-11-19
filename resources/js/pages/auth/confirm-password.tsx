import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { translator, useT } from '@/i18n';
import { store } from '@/routes/password/confirm';

export default function ConfirmPassword() {
    const t = useT();

    return (
        <>
            <Head title={t('auth.confirmPassword.title')} />

            <Form {...store.form()} resetOnSuccess={['password']}>
                {({ processing, errors }) => (
                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="password">{t('auth.fields.password')}</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                placeholder={t('auth.fields.password')}
                                autoComplete="current-password"
                                autoFocus
                            />

                            <InputError message={errors.password} />
                        </div>

                        <div className="flex items-center">
                            <Button className="w-full" disabled={processing} data-test="confirm-password-button">
                                {processing && <Spinner />}
                                {t('auth.confirmPassword.submit')}
                            </Button>
                        </div>
                    </div>
                )}
            </Form>
        </>
    );
}

// Judul bingkai halaman diterjemahkan dari bahasa halaman (prop bersama `locale`), tanpa hook.
ConfirmPassword.layout = ({ locale }: { locale?: string }) => {
    const t = translator(locale === 'en' ? 'en' : 'id');

    return {
        title: t('auth.confirmPassword.title'),
        description: t('auth.confirmPassword.description'),
    };
};
