<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Setup\UnitType;
use App\Models\Assessment;
use App\Models\Stratum;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Kalkulator sampel (docs/03 bagian 7). Perhitungan selalu di server dengan SampleCalculator yang lolos fixture,
 * dari populasi strata tersimpan, agar angka di layar sama dengan angka di snapshot.
 */
class SamplingController extends SetupController
{
    public function show(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'sampling');
        $locked = $assessment->status->parametersLocked();
        $draft = ($locked ? ($assessment->parameter_snapshot['parameters'] ?? null) : null) ?? $assessment->parameter_draft ?? [];
        $plan = $locked ? ($assessment->parameter_snapshot['samplePlan'] ?? $draft['samplePlan'] ?? null) : ($draft['samplePlan'] ?? null);
        $units = $assessment->units()->get(['type']);

        return Inertia::render('setup/sampling', [
            ...$this->common($assessment, $roles),
            'canEdit' => $this->canEditParameters($roles) && ! $locked,
            'strata' => $assessment->strata()->get()->map(fn (Stratum $s) => [
                'code' => $s->code, 'name' => $s->name, 'population' => $s->population,
            ])->all(),
            'settings' => $draft['sampling'] ?? null,
            'suggested' => [
                'projects' => $units->where('type', UnitType::Project)->count(),
                'locations' => $units->count(),
            ],
            'plan' => $plan,
        ]);
    }

    public function store(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'sampling'));
        $data = $request->validate([
            'projects' => ['required', 'integer', 'between:0,10000'],
            'locations' => ['required', 'integer', 'between:0,10000'],
        ]);
        $setup->saveSamplePlan($assessment, (int) $data['projects'], (int) $data['locations']);

        return back()->with('status', 'saved');
    }
}
