<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Navigation\ModuleCatalog;
use App\Domain\Setup\PlanningChecklist;
use App\Http\Controllers\Controller;
use App\Http\Presenters\AssessmentPresenter;
use App\Models\Assessment;
use App\Services\SetupFactsCollector;
use App\Support\AssessmentAccess;
use Illuminate\Http\Request;

/**
 * Dasar halaman tahap 1 (perencanaan). Hak buka mengikuti katalog modul yang diturunkan dari matriks docs/04; hak
 * ubah diperiksa terpisah. Pengguna tanpa peran pada asesmen menerima 404 (aturan 4).
 */
abstract class SetupController extends Controller
{
    /**
     * Peran pengguna pada asesmen, atau 404/403 bila halaman modul ini tidak boleh dibuka.
     *
     * @return list<Role>
     */
    protected function pageRoles(Request $request, Assessment $assessment, string $module): array
    {
        $user = $request->user()->load(['memberships', 'teamAssignments']);
        $roles = AssessmentAccess::requireMember($user, $assessment);
        $entry = collect(ModuleCatalog::all($assessment->status))->firstWhere('key', $module);
        abort_unless($entry !== null && $entry->visibleTo($roles), 403);

        return $roles;
    }

    /** @param  list<Role>  $roles */
    protected function canEditParameters(array $roles): bool
    {
        return Permissions::canWrite($roles, Resource::ParametersBeforeLock);
    }

    /**
     * Peran pelaku untuk perubahan parameter (asesor utama asesmen ini), atau 403.
     *
     * @param  list<Role>  $roles
     */
    protected function requireParameterWriter(array $roles): Role
    {
        abort_unless($this->canEditParameters($roles), 403);

        return Role::LeadAssessor;
    }

    /**
     * Bagian bersama setiap halaman: kepala asesmen dan menu, serta keadaan kunci.
     *
     * @param  list<Role>  $roles
     * @return array<string, mixed>
     */
    protected function common(Assessment $assessment, array $roles): array
    {
        $assessment->loadMissing('organization');
        $paths = ['details' => 'setup', 'units' => 'setup/units', 'strata' => 'setup/strata', 'parameters' => 'setup/parameters',
            'sampling' => 'setup/sampling', 'team' => 'setup/team', 'kickoff' => 'setup/kickoff'];
        $items = PlanningChecklist::items(SetupFactsCollector::for($assessment), $assessment->status->parametersLocked());
        $visible = collect(ModuleCatalog::all($assessment->status))->filter(fn ($m) => $m->visibleTo($roles))->pluck('key')->all();

        return [
            'assessment' => AssessmentPresenter::menu($assessment, $roles),
            // Navigasi tahap 1 dengan tanda kelengkapan setiap halaman.
            'planning' => array_values(array_map(fn (array $item) => [
                ...$item,
                'href' => route('assessments.module', ['assessment' => $assessment, 'path' => $paths[$item['key']]]),
            ], array_filter($items, fn (array $item) => in_array($item['key'], $visible, true)))),
            'locked' => $assessment->status->parametersLocked(),
            'lockedAt' => $assessment->locked_at?->toIso8601String(),
            'closed' => $assessment->status->isClosed(),
        ];
    }
}
