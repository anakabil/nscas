<?php

namespace App\Auth;

use Illuminate\Http\Request;
use Laravel\Fortify\LoginRateLimiter;

/**
 * Penguncian masuk (docs/04 bagian 3, docs/14 K4 dan K27). Hanya percobaan yang gagal dihitung; alur Fortify menambah
 * hitungan saat gagal dan menghapus hitungan akun saat berhasil.
 *
 * 1. Per akun: 5 kali gagal dalam 15 menit untuk pasangan surel dan alamat IP.
 * 2. Per alamat IP: 30 kali gagal dalam 15 menit lintas akun, untuk menahan percobaan masuk ke banyak akun dari satu
 *    alamat. Batasnya longgar karena staf satu kantor proyek dapat berbagi satu alamat. Kuncinya HMAC alamat IP, bukan
 *    alamatnya, dan tidak dihapus saat ada yang berhasil masuk.
 */
class LoginLockout extends LoginRateLimiter
{
    public const DECAY_SECONDS = 15 * 60;

    public const IP_MAX_ATTEMPTS = 30;

    public function tooManyAttempts(Request $request)
    {
        return parent::tooManyAttempts($request) || $this->limiter->tooManyAttempts($this->ipKey($request), self::IP_MAX_ATTEMPTS);
    }

    public function increment(Request $request)
    {
        $this->limiter->hit($this->throttleKey($request), self::DECAY_SECONDS);
        $this->limiter->hit($this->ipKey($request), self::DECAY_SECONDS);
    }

    public function availableIn(Request $request)
    {
        return max(
            parent::tooManyAttempts($request) ? $this->limiter->availableIn($this->throttleKey($request)) : 0,
            $this->limiter->tooManyAttempts($this->ipKey($request), self::IP_MAX_ATTEMPTS) ? $this->limiter->availableIn($this->ipKey($request)) : 0,
        );
    }

    private function ipKey(Request $request): string
    {
        return 'login-ip|'.hash_hmac('sha256', (string) $request->ip(), (string) config('app.key'));
    }
}
