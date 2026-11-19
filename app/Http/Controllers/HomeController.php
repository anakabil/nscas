<?php

namespace App\Http\Controllers;

use App\Domain\Access\Role;
use App\Domain\Navigation\MenuBuilder;
use App\Http\Presenters\AssessmentPresenter;
use App\Http\Presenters\ProgressPresenter;
use App\Models\Assessment;
use App\Services\SetupFactsCollector;
use App\Support\AssessmentAccess;
use DateTimeImmutable;
use Illuminate\Support\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Beranda: dasbor progres pengukuran (fase R1), menu utama menurut tahap penilaian untuk asesmen yang dipilih, dan
 * menu menurut jenis akun.
 */
class HomeController extends Controller
{
    /**
     * Peran yang melihat dasbor progres (keputusan pemilik proyek, 19 November 2026). Koordinator unit dan pemirsa
     * eksekutif tidak melihatnya.
     */
    public const DASHBOARD_ROLES = [Role::SuperAdmin, Role::LeadAssessor, Role::Assessor, Role::ClientAdmin];

    public function __invoke(Request $request): Response
    {
        $user = $request->user()->load(['memberships.organization', 'teamAssignments']);
        $allRoles = $user->allRoles();

        // Kueri selalu berangkat dari visibleTo agar asesmen organisasi lain tidak pernah termuat (aturan 4).
        $assessments = AssessmentAccess::visibleTo($user)->with('organization')->latest()->limit(50)->get();

        $requested = $request->string('assessment')->toString();
        /** @var Assessment|null $selected */
        $selected = $assessments->firstWhere('id', $requested)
            ?? $assessments->first(fn (Assessment $a) => ! $a->status->isClosed())
            ?? $assessments->first();

        return Inertia::render('home', [
            'persona' => [
                'primaryRole' => Role::primary($allRoles)?->value,
                'roles' => array_map(fn (Role $r) => $r->value, $allRoles),
                'organizations' => $user->memberships->map(fn ($m) => $m->organization->name)->unique()->values()->all(),
            ],
            'accountMenu' => MenuBuilder::account($allRoles),
            'assessments' => $assessments
                ->map(fn (Assessment $a) => AssessmentPresenter::summary($a, AssessmentAccess::rolesFor($user, $a)))
                ->all(),
            'selected' => $selected
                ? AssessmentPresenter::menu($selected, AssessmentAccess::rolesFor($user, $selected))
                : null,
            // Dimuat ulang sendiri setiap 60 detik oleh halaman (muat ulang sebagian Inertia).
            'dashboard' => fn () => $this->dashboard($user, $assessments),
        ]);
    }

    /**
     * Progres setiap asesmen yang boleh dipantau pengguna, beserta ringkasan per tahap. Null bila jenis akun pengguna
     * tidak termasuk pemantau.
     *
     * @param  Collection<int, Assessment>  $assessments
     * @return array<string, mixed>|null
     */
    private function dashboard($user, Collection $assessments): ?array
    {
        $monitored = $assessments->filter(fn (Assessment $a) => array_intersect(
            array_map(fn (Role $r) => $r->value, AssessmentAccess::rolesFor($user, $a)),
            array_map(fn (Role $r) => $r->value, self::DASHBOARD_ROLES),
        ) !== [])->values();
        $isMonitor = array_intersect(
            array_map(fn (Role $r) => $r->value, $user->allRoles()),
            array_map(fn (Role $r) => $r->value, self::DASHBOARD_ROLES),
        ) !== [];
        if (! $isMonitor) {
            return null;
        }

        $facts = SetupFactsCollector::forMany($monitored);
        $today = new DateTimeImmutable('today');
        $rows = $monitored->map(function (Assessment $a) use ($user, $facts, $today) {
            $roles = AssessmentAccess::rolesFor($user, $a);

            return [
                ...AssessmentPresenter::summary($a, $roles),
                ...ProgressPresenter::for($a, $roles, $facts[$a->id], $today),
            ];
        });
        $active = $rows->where('closed', false);
        $byStage = array_fill(1, 6, 0);
        foreach ($active as $row) {
            $byStage[$row['stage']]++;
        }
        $needsAttention = $active->filter(fn ($row) => array_diff($row['attention'], ['readyToAdvance']) !== []);

        return [
            'updatedAt' => now()->toIso8601String(),
            'totals' => [
                'active' => $active->count(),
                'closed' => $rows->count() - $active->count(),
                'attention' => $needsAttention->count(),
                'ready' => $active->filter(fn ($row) => in_array('readyToAdvance', $row['attention'], true))->count(),
                'byStage' => array_values($byStage),
            ],
            'rows' => $rows
                ->sortBy([
                    fn ($a, $b) => $a['closed'] <=> $b['closed'],
                    fn ($a, $b) => count(array_diff($b['attention'], ['readyToAdvance'])) <=> count(array_diff($a['attention'], ['readyToAdvance'])),
                    fn ($a, $b) => $a['periodEnd'] <=> $b['periodEnd'],
                ])
                ->values()
                ->all(),
        ];
    }
}
