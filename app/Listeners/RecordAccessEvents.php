<?php

namespace App\Listeners;

use App\Models\User;
use App\Support\Audit;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Str;
use Laravel\Fortify\Events\RecoveryCodesGenerated;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

/**
 * Peristiwa akses yang wajib dicatat (docs/04 bagian 6): masuk, gagal masuk, penguncian, keluar, verifikasi dua
 * langkah, dan atur ulang kata sandi. Surel yang dicoba tetapi tidak terdaftar tidak disimpan; yang dicatat hanya
 * HMAC-nya agar pola percobaan tetap dapat dikenali.
 */
class RecordAccessEvents
{
    public function subscribe(Dispatcher $events): void
    {
        $events->listen(Login::class, function (Login $e) {
            session()->put('auth.started_at', now()->getTimestamp());
            session()->forget('auth.strict_idle');
            $this->record('auth.login', $e->user);
        });
        $events->listen(Failed::class, fn (Failed $e) => $this->record('auth.login_failed', $e->user,
            $e->user === null ? ['emailHash' => $this->emailHash($e->credentials['email'] ?? null)] : []));
        $events->listen(Lockout::class, function (Lockout $e) {
            $email = (string) $e->request->input('email');
            $user = User::where('email', Str::lower($email))->first();
            $this->record('auth.locked', $user, $user === null ? ['emailHash' => $this->emailHash($email)] : []);
        });
        $events->listen(Logout::class, fn (Logout $e) => $this->record('auth.logout', $e->user));
        $events->listen(PasswordReset::class, fn (PasswordReset $e) => $this->record('auth.password_reset', $e->user));
        $events->listen(TwoFactorAuthenticationConfirmed::class, fn ($e) => $this->record('auth.two_factor_enabled', $e->user));
        $events->listen(TwoFactorAuthenticationDisabled::class, fn ($e) => $this->record('auth.two_factor_disabled', $e->user));
        $events->listen(RecoveryCodesGenerated::class, fn ($e) => $this->record('auth.recovery_codes', $e->user));
        $events->listen(TwoFactorAuthenticationFailed::class, fn ($e) => $this->record('auth.two_factor_failed', $e->user));
    }

    /** @param  array<string, mixed>  $changes */
    private function record(string $action, mixed $user, array $changes = []): void
    {
        Audit::record($action, $user instanceof User ? $user : null, $changes);
    }

    private function emailHash(mixed $email): ?string
    {
        return is_string($email) && $email !== '' ? hash_hmac('sha256', Str::lower(trim($email)), (string) config('app.key')) : null;
    }
}
