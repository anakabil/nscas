<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Scoring\StratumGroup;
use App\Models\Assessment;
use App\Models\Stratum;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Strata jabatan dan populasinya. Tidak dapat diubah setelah dikunci (aturan 5). */
class StratumController extends SetupController
{
    public function index(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'strata');
        $strata = $assessment->strata()->get()->map(fn (Stratum $s) => [
            'id' => $s->id,
            'code' => $s->code,
            'name' => $s->name,
            'group' => $s->group->value,
            'population' => $s->population,
            'isContractor' => $s->is_contractor,
        ])->all();

        return Inertia::render('setup/strata', [
            ...$this->common($assessment, $roles),
            'canEdit' => $this->canEditParameters($roles) && ! $assessment->status->parametersLocked(),
            'strata' => $strata,
        ]);
    }

    public function store(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'strata'));
        $setup->createStratum($assessment, $this->validated($request));

        return back()->with('status', 'saved');
    }

    public function update(Request $request, Assessment $assessment, Stratum $stratum, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'strata'));
        abort_unless($stratum->assessment_id === $assessment->id, 404);
        $setup->updateStratum($assessment, $stratum, $this->validated($request));

        return back()->with('status', 'saved');
    }

    public function populations(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'strata'));
        $data = $request->validate([
            'populations' => ['required', 'array'],
            'populations.*' => ['required', 'integer', 'between:0,10000000'],
        ]);
        $setup->updatePopulations($assessment, array_map('intval', $data['populations']));

        return back()->with('status', 'saved');
    }

    public function destroy(Request $request, Assessment $assessment, Stratum $stratum, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'strata'));
        abort_unless($stratum->assessment_id === $assessment->id, 404);
        $setup->deleteStratum($assessment, $stratum);

        return back()->with('status', 'saved');
    }

    /** @return array{code: string, name: string, group: string, population: int, is_contractor: bool} */
    private function validated(Request $request): array
    {
        $request->merge(['code' => Str::upper(trim((string) $request->input('code')))]);
        $data = $request->validate([
            'code' => ['required', 'regex:/^[A-Z0-9_-]{1,20}$/'],
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'group' => ['required', Rule::enum(StratumGroup::class)],
            'population' => ['required', 'integer', 'between:0,10000000'],
            'is_contractor' => ['boolean'],
        ]);

        return [...$data, 'population' => (int) $data['population'], 'is_contractor' => (bool) ($data['is_contractor'] ?? false)];
    }
}
