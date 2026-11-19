<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class SecurityController extends Controller
{
    /**
     * Show the user's security settings page.
     */
    public function edit(TwoFactorAuthenticationRequest $request): Response
    {
        $props = [
            'canManageTwoFactor' => Features::canManageTwoFactorAuthentication(),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ];

        if (Features::canManageTwoFactorAuthentication()) {
            $request->ensureStateIsValid();

            $props['twoFactorEnabled'] = $request->user()->hasEnabledTwoFactorAuthentication();
            $props['requiresConfirmation'] = Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm');
        }

        // Pemberitahuan kewajiban verifikasi dua langkah dihitung di sini, bukan lewat pesan kilat sesi: halaman ini
        // didahului konfirmasi kata sandi, sehingga pesan kilat dari pengalihan sudah hilang saat halaman tampil.
        $user = $request->user()->loadMissing(['memberships', 'teamAssignments']);
        $props['twoFactorRequired'] = config('nscas.enforce_two_factor')
            && $user->two_factor_confirmed_at === null
            && collect($user->allRoles())->contains(fn ($role) => $role->requiresTwoFactor());

        $props['mustChangePassword'] = $user->must_change_password;

        return Inertia::render('settings/security', $props);
    }

    /**
     * Update the user's password.
     */
    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->forceFill([
            'password' => $request->password,
            'must_change_password' => false,
        ])->save();
        Audit::record('auth.password_changed', $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password updated.')]);

        return back();
    }
}
