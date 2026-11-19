<?php

namespace App\Http\Controllers;

use App\Domain\Navigation\MenuBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** Halaman tingkat akun di luar asesmen tertentu: status sistem dan area yang dibangun pada fase berikutnya. */
class AccountAreaController extends Controller
{
    /** Area yang belum dibangun ulang. Hanya dapat dibuka bila menu akun pengguna memuatnya. */
    public function pending(Request $request, string $area): Response
    {
        $user = $request->user()->load(['memberships', 'teamAssignments']);
        $item = collect(MenuBuilder::account($user->allRoles()))->firstWhere('key', $area);
        abort_if($item === null, 403);

        return Inertia::render('pending', ['area' => $item['key'], 'buildPhase' => $item['buildPhase']]);
    }

    /** Status sistem untuk pengelola: basis data, antrean, dan penyimpanan berkas. Tanpa data asesmen. */
    public function systemStatus(Request $request): Response
    {
        abort_unless($request->user()->is_super_admin, 403);

        $check = static function (callable $probe): bool {
            try {
                return (bool) $probe();
            } catch (Throwable) {
                return false;
            }
        };

        return Inertia::render('system-status', [
            'checks' => [
                ['key' => 'database', 'ok' => $check(fn () => DB::select('select 1 as ok')[0]->ok === 1)],
                ['key' => 'queue', 'ok' => $check(fn () => Schema::hasTable('jobs'))],
                ['key' => 'storage', 'ok' => $check(function () {
                    $disk = Storage::disk();
                    $disk->put('.healthcheck', 'ok');

                    return $disk->get('.healthcheck') === 'ok';
                })],
            ],
            'checkedAt' => now()->toIso8601String(),
        ]);
    }
}
