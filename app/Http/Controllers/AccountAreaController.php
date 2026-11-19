<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** Halaman tingkat akun di luar asesmen tertentu: status sistem beserta peristiwa akses terakhir. */
class AccountAreaController extends Controller
{
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
            'access' => $this->accessEvents(),
        ]);
    }

    /**
     * Dua puluh peristiwa akses terakhir (docs/04 bagian 6). Akun dikenali dari entitas catatan, karena peristiwa gagal
     * masuk tidak memiliki pelaku yang sudah masuk.
     *
     * @return list<array{id: int, at: string, action: string, name: ?string, email: ?string}>
     */
    private function accessEvents(): array
    {
        $rows = AuditLog::where('action', 'like', 'auth.%')->orderByDesc('occurred_at')->orderByDesc('id')->limit(20)->get();
        $users = User::whereIn('id', $rows->where('entity_type', 'User')->pluck('entity_id')->filter()->map(fn ($id) => (int) $id)->all())
            ->get(['id', 'name', 'email'])->keyBy('id');

        return $rows->map(function (AuditLog $r) use ($users) {
            $user = $r->entity_type === 'User' ? $users->get((int) $r->entity_id) : null;

            return ['id' => $r->id, 'at' => $r->occurred_at->toIso8601String(), 'action' => $r->action, 'name' => $user?->name, 'email' => $user?->email];
        })->values()->all();
    }
}
