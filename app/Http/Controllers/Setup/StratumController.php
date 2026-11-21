<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Scoring\StratumGroup;
use App\Domain\Setup\JobTitles;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\Stratum;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Strata jabatan, populasinya, dan nama jabatan organisasi pada setiap strata. Tidak dapat diubah setelah dikunci
 * (aturan 5). Susunan strata dapat disimpan sebagai templat organisasi untuk asesmen berikutnya.
 */
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
            'jobTitles' => array_values($s->job_titles ?? []),
        ])->all();
        $template = Organization::whereKey($assessment->organization_id)->first(['id', 'strata_template'])?->strata_template;

        return Inertia::render('setup/strata', [
            ...$this->common($assessment, $roles),
            'canEdit' => $this->canEditParameters($roles) && ! $assessment->status->parametersLocked(),
            'canSaveTemplate' => $this->canEditParameters($roles) && $strata !== [],
            'templateCount' => count($template ?? []),
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

    /** Menyimpan susunan strata asesmen ini sebagai templat organisasi (tanpa jumlah pekerja). */
    public function saveTemplate(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $actor = $this->requireParameterWriter($this->pageRoles($request, $assessment, 'strata'));
        $setup->saveStrataTemplate($assessment, $actor);

        return back()->with('status', 'templateSaved');
    }

    public function destroy(Request $request, Assessment $assessment, Stratum $stratum, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'strata'));
        abort_unless($stratum->assessment_id === $assessment->id, 404);
        $setup->deleteStratum($assessment, $stratum);

        return back()->with('status', 'saved');
    }

    /** @return array{code: string, name: string, group: string, population: int, is_contractor: bool, job_titles: list<string>} */
    private function validated(Request $request): array
    {
        $request->merge(['code' => Str::upper(trim((string) $request->input('code')))]);
        $data = $request->validate([
            'code' => ['required', 'regex:/^[A-Z0-9_-]{1,20}$/'],
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'group' => ['required', Rule::enum(StratumGroup::class)],
            'population' => ['required', 'integer', 'between:0,10000000'],
            'is_contractor' => ['boolean'],
            // Satu nama jabatan per baris atau dipisah koma; aturan isi diperiksa App\Domain\Setup\JobTitles.
            'job_titles' => ['nullable', 'string', 'max:5000'],
        ]);

        return [
            'code' => $data['code'],
            'name' => $data['name'],
            'group' => $data['group'],
            'population' => (int) $data['population'],
            'is_contractor' => (bool) ($data['is_contractor'] ?? false),
            'job_titles' => JobTitles::parse($data['job_titles'] ?? null),
        ];
    }
}
