// Sign-in and account settings text, English. Indonesian (i18n/id) is the source; keep the keys identical.

export const account = {
    auth: {
        fields: {
            email: 'Email address',
            emailPlaceholder: 'name@example.com',
            password: 'Password',
            passwordConfirmation: 'Confirm password',
        },
        passwordVisibility: {
            show: 'Show password',
            hide: 'Hide password',
        },
        login: {
            title: 'Sign in',
            heading: 'Sign in to your account',
            description: 'Enter your email address and password to sign in.',
            forgotPassword: 'Forgot your password?',
            remember: 'Remember me',
            submit: 'Sign in',
        },
        forgotPassword: {
            title: 'Forgot password',
            description: 'Enter your account email address. A link to reset your password will be sent to that address.',
            submit: 'Send reset link',
            returnTo: 'Or return to',
            returnLink: 'the sign-in page',
        },
        resetPassword: {
            title: 'Reset password',
            description: 'Enter a new password for your account.',
            submit: 'Reset password',
        },
        confirmPassword: {
            title: 'Confirm password',
            description: 'The page you are opening is protected. Enter your password again to continue.',
            submit: 'Confirm password',
        },
        twoFactorChallenge: {
            title: 'Two-step verification',
            code: {
                heading: 'Verification code',
                description: 'Enter the verification code shown by your authenticator app.',
            },
            recovery: {
                heading: 'Recovery code',
                description: 'Enter one of your recovery codes to prove that this account is yours.',
                placeholder: 'Enter recovery code',
            },
            submit: 'Continue',
            alternative: 'Or you can',
            useRecoveryCode: 'sign in with a recovery code',
            useCode: 'sign in with a verification code',
        },
    },
    settings: {
        twoFactorRequired: 'Your role requires two-step verification. Enable it before continuing.',
        save: 'Save',
        errorTitle: 'Something went wrong',
        profile: {
            title: 'Profile settings',
            heading: 'Profile',
            description: 'Update your name and email address.',
            name: 'Name',
            namePlaceholder: 'Full name',
            email: 'Email address',
        },
        security: {
            title: 'Security settings',
        },
        password: {
            heading: 'Update password',
            description: 'Use a long, random password to keep your account secure.',
            current: 'Current password',
            new: 'New password',
            confirmation: 'Confirm new password',
        },
        twoFactor: {
            heading: 'Two-step verification',
            description: 'Manage your two-step verification settings.',
            enabledHelp:
                'Each time you sign in, you will be asked for the verification code shown by the authenticator app on your mobile phone.',
            disabledHelp:
                'Once two-step verification is enabled, you will be asked for a verification code each time you sign in. The code is shown by the authenticator app on your mobile phone.',
            enable: 'Enable two-step verification',
            disable: 'Disable two-step verification',
            continueSetup: 'Continue setup',
            loadError: 'Two-step verification data could not be loaded. Reload the page, then try again.',
        },
        twoFactorSetup: {
            enableTitle: 'Enable two-step verification',
            enableDescription:
                'To finish enabling two-step verification, scan the QR code or enter the setup key in your authenticator app.',
            enabledTitle: 'Two-step verification is enabled',
            enabledDescription: 'Scan the QR code or enter the setup key in your authenticator app.',
            verifyTitle: 'Confirm the verification code',
            verifyDescription: 'Enter the {length}-digit code from your authenticator app.',
            manualEntry: 'Or enter the setup key manually',
            continue: 'Continue',
            close: 'Close',
            back: 'Back',
            confirm: 'Confirm',
        },
        recoveryCodes: {
            heading: 'Recovery codes',
            description:
                'Recovery codes let you sign in again if you lose the device your authenticator app is installed on. Store them in a secure password manager app.',
            show: 'Show recovery codes',
            hide: 'Hide recovery codes',
            regenerate: 'Regenerate codes',
            listLabel: 'Recovery codes',
            loading: 'Loading recovery codes',
            usageBefore:
                'Each recovery code can be used only once to sign in to your account and is then removed. If you need new codes, select',
            usageAfter: 'above.',
        },
    },
} as const;
