<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dua syarat akun (docs/04 bagian 3):
 *   1. akun yang dinonaktifkan langsung dikeluarkan;
 *   2. peran yang mewajibkan verifikasi dua langkah harus mengaktifkannya sebelum membuka halaman kerja.
 */
class EnsureAccountIsUsable
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null) {
            return $next($request);
        }

        if (! $user->is_active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors(['email' => __('auth.inactive')]);
        }

        if (config('nscas.enforce_two_factor') && $user->two_factor_confirmed_at === null) {
            $user->loadMissing(['memberships', 'teamAssignments']);
            foreach ($user->allRoles() as $role) {
                if ($role->requiresTwoFactor()) {
                    return redirect()->route('security.edit');
                }
            }
        }

        return $next($request);
    }
}
