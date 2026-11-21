<?php

namespace App\Http\Controllers\Observations;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Observations\ObservationRules;
use App\Http\Controllers\Controller;
use App\Models\ObservationWindow;
use App\Services\Respondents\RespondentScope;
use App\Support\AssessmentAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pintu masuk aplikasi kamera observasi yang dipasang di layar utama telepon (keputusan R5, fase R12): daftar masa
 * observasi yang sedang terbuka dan boleh direkam pengguna ini, lintas asesmen. Bila hanya ada satu, kamera langsung
 * dibuka.
 */
class ObservationLauncherController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        $user = $request->user()->load(['memberships', 'teamAssignments']);
        $now = now();
        $items = [];
        foreach (AssessmentAccess::visibleTo($user)->with('organization:id,name')->orderBy('name')->get() as $assessment) {
            $roles = AssessmentAccess::rolesFor($user, $assessment);
            if (! Permissions::canWrite($roles, Resource::EvidenceAndObservations)) {
                continue;
            }
            $scope = RespondentScope::units($user, $assessment, $roles, Resource::EvidenceAndObservations, write: true);
            $windows = ObservationWindow::where('assessment_id', $assessment->id)->where('opens_at', '<=', $now)->where('closes_at', '>', $now)
                ->when($scope !== null, fn ($q) => $q->whereIn('unit_id', $scope))->with('unit:id,name')->orderBy('closes_at')->get();
            foreach ($windows as $window) {
                if (! ObservationRules::windowOpen($assessment->status, $window->opens_at, $window->closes_at, $now)) {
                    continue;
                }
                $items[] = [
                    'id' => $window->id,
                    'title' => $window->title,
                    'unit' => $window->unit?->name,
                    'assessment' => $assessment->name,
                    'organization' => $assessment->organization?->name,
                    'closesAt' => $window->closes_at->toIso8601String(),
                    'href' => route('observations.capture', ['assessment' => $assessment, 'window' => $window->id]),
                ];
            }
        }
        if (count($items) === 1 && ! $request->boolean('list')) {
            return redirect()->to($items[0]['href']);
        }

        return Inertia::render('observations/launcher', ['windows' => $items]);
    }
}
