<?php

namespace App\Auth;

use Illuminate\Http\Request;
use Laravel\Fortify\LoginRateLimiter;

/**
 * Penguncian akun setelah 5 kali gagal masuk dalam 15 menit (docs/04 bagian 3). Hanya percobaan yang gagal dihitung
 * (alur Fortify menambah hitungan saat gagal dan menghapusnya saat berhasil); kuncinya surel dan alamat IP.
 */
class LoginLockout extends LoginRateLimiter
{
    public const DECAY_SECONDS = 15 * 60;

    public function increment(Request $request)
    {
        $this->limiter->hit($this->throttleKey($request), self::DECAY_SECONDS);
    }
}
