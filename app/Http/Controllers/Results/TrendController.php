<?php

namespace App\Http\Controllers\Results;

use App\Models\Assessment;
use App\Services\Results\ResultsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Perbandingan antarperiode (docs/01 M9, docs/12 temuan T6): hasil final dengan versi instrumen yang sama. */
class TrendController extends MonitoringStageController
{
    public function index(Request $request, Assessment $assessment, ResultsService $results): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'trend');

        return Inertia::render('results/trend', [
            ...$this->collectionCommon($assessment, $roles),
            'trend' => $results->trend($request->user()->load(['memberships', 'teamAssignments']), $assessment),
        ]);
    }
}
