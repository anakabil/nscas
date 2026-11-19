<?php

namespace App\Http\Controllers;

use App\Domain\Navigation\ModuleCatalog;
use App\Http\Presenters\AssessmentPresenter;
use App\Http\Presenters\ProgressPresenter;
use App\Services\SetupFactsCollector;
use DateTimeImmutable;
use App\Models\Assessment;
use App\Support\AssessmentAccess;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AssessmentController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user()->load(['memberships', 'teamAssignments']);
        $assessments = AssessmentAccess::visibleTo($user)->with('organization')->latest()->get();

        return Inertia::render('assessments/index', [
            'assessments' => $assessments
                ->map(fn (Assessment $a) => AssessmentPresenter::summary($a, AssessmentAccess::rolesFor($user, $a)))
                ->all(),
        ]);
    }

    /** Pusat asesmen: penanda enam tahap, menu per tahap, dan syarat ke status berikutnya. */
    public function show(Request $request, Assessment $assessment): Response
    {
        $user = $request->user()->load(['memberships', 'teamAssignments']);
        $roles = AssessmentAccess::requireMember($user, $assessment);
        $assessment->load('organization');

        return Inertia::render('assessments/show', [
            'assessment' => AssessmentPresenter::menu($assessment, $roles),
            'progress' => ProgressPresenter::for($assessment, $roles, SetupFactsCollector::for($assessment), new DateTimeImmutable('today')),
        ]);
    }

    /**
     * Halaman kerja satu modul. Pada fase R0 modul belum dibangun ulang, sehingga halaman ini menjelaskan isi
     * modul dan fase pembangunannya. Hak akses tetap diperiksa agar perilakunya sama dengan modul jadi.
     */
    public function module(Request $request, Assessment $assessment, string $path): Response
    {
        $user = $request->user()->load(['memberships', 'teamAssignments']);
        $roles = AssessmentAccess::requireMember($user, $assessment);
        $module = ModuleCatalog::find($path, $assessment->status);
        abort_if($module === null, 404);
        abort_unless($module->visibleTo($roles), 403);
        $assessment->load('organization');

        return Inertia::render('assessments/module', [
            'assessment' => AssessmentPresenter::menu($assessment, $roles),
            'module' => [
                'key' => $module->key,
                'stage' => $module->stage?->number(),
                'ready' => $module->ready,
                'buildPhase' => $module->buildPhase,
            ],
        ]);
    }
}
