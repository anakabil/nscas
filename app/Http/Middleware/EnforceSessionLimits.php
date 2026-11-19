<?php

namespace App\Http\Middleware;

use App\Domain\Access\SessionPolicy;
use App\Models\User;
use App\Support\Audit;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menegakkan batas sesi (docs/04 bagian 3, App\Domain\Access\SessionPolicy). Masuk lewat kuki "ingat saya" tidak
 * diterima karena akan melewati batas 8 jam; pengguna diminta masuk ulang.
 */
class EnforceSessionLimits
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        // Halaman responden berjalan tanpa sesi (docs/02 bagian 4); batas ini hanya untuk sesi masuk konsol.
        if (! $user instanceof User || ! $request->hasSession()) {
            return $next($request);
        }
        $session = $request->session();
        $now = now()->getTimestamp();
        if (! $session->has('auth.started_at')) {
            $session->put('auth.started_at', $now);
        }
        if (! $session->has('auth.strict_idle')) {
            $session->put('auth.strict_idle', $this->isOperator($user));
        }
        $reason = Auth::guard('web')->viaRemember() ? 'absolute' : SessionPolicy::expiry(
            (int) $session->get('auth.started_at'),
            (int) $session->get('auth.last_seen_at', $now),
            $now,
            (bool) $session->get('auth.strict_idle'),
        );
        if ($reason !== null) {
            Audit::record('auth.session_expired', $user, ['reason' => $reason]);
            Auth::guard('web')->logout();
            $session->invalidate();
            $session->regenerateToken();
            if ($request->expectsJson()) {
                return response()->json(['message' => __('auth.session_'.$reason)], 401);
            }

            return redirect()->route('login')->with('status', $reason === 'idle' ? 'sessionIdle' : 'sessionExpired');
        }
        $session->put('auth.last_seen_at', $now);

        return $next($request);
    }

    /** Pengguna Nusa Safety: pengelola sistem atau anggota organisasi operator. */
    private function isOperator(User $user): bool
    {
        return $user->is_super_admin || $user->memberships()->whereHas('organization', fn ($q) => $q->where('is_operator', true))->exists();
    }
}
