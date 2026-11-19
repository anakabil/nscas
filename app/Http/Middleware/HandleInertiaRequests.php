<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'locale' => app()->getLocale(),
            // Hanya kolom yang diperlukan antarmuka; rahasia dua langkah dan sandi tidak pernah dikirim.
            'auth' => [
                'user' => ($user = $request->user()) ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'isSuperAdmin' => $user->is_super_admin,
                    'twoFactorEnabled' => $user->two_factor_confirmed_at !== null,
                    'mustChangePassword' => $user->must_change_password,
                ] : null,
            ],
            // Kata sandi sementara akun baru atau yang diatur ulang: hanya ada pada satu permintaan berikutnya.
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
                'temporaryPassword' => fn () => $request->session()->get('temporaryPassword'),
            ],
        ];
    }
}
