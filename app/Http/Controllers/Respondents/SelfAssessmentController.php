<?php

namespace App\Http\Controllers\Respondents;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Setup\UnitTree;
use App\Models\Assessment;
use App\Models\SelfAssessment;
use App\Models\Unit;
use App\Services\SelfAssessment\SelfAssessmentAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Penilaian mandiri manajemen di konsol (docs/01 M4). Dilihat asesor dan administrator klien (matriks docs/04 baris
 * "Penilaian mandiri"); tautan diterbitkan administrator klien, sama dengan token survei. Jawaban teridentifikasi.
 */
class SelfAssessmentController extends CollectionController
{
    public function index(Request $request, Assessment $assessment, SelfAssessmentAdmin $admin): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'selfAssessments');
        $units = Unit::where('assessment_id', $assessment->id)->get(['id', 'parent_id', 'name']);

        return Inertia::render('respondents/self-assessments', [
            ...$this->collectionCommon($assessment, $roles),
            'canEdit' => $this->distribution($assessment) === 'open' && Permissions::canWrite($roles, Resource::TokensAndParticipation),
            'units' => array_map(
                fn (array $u) => ['id' => $u['id'], 'name' => $u['name'], 'depth' => $u['depth']],
                UnitTree::flatten($units->map(fn (Unit $u) => ['id' => $u->id, 'parentId' => $u->parent_id, 'name' => $u->name])->all()),
            ),
            'rows' => $admin->list($assessment),
            // Tautan yang baru diterbitkan, hanya untuk satu kali tampil.
            'issued' => $request->session()->get('selfAssessmentLink'),
        ]);
    }

    public function show(Request $request, Assessment $assessment, string $selfAssessment, SelfAssessmentAdmin $admin): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'selfAssessments');

        return Inertia::render('respondents/self-assessment-detail', [
            ...$this->collectionCommon($assessment, $roles),
            'detail' => $admin->detail($assessment, $selfAssessment),
            'backHref' => route('assessments.module', ['assessment' => $assessment, 'path' => 'self-assessments']),
        ]);
    }

    public function store(Request $request, Assessment $assessment, SelfAssessmentAdmin $admin): RedirectResponse
    {
        $actor = $this->writerFor($this->pageRoles($request, $assessment, 'selfAssessments'), Resource::TokensAndParticipation);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'position' => ['required', 'string', 'min:2', 'max:200'],
            'unit_id' => ['required', 'string', Rule::exists('units', 'id')->where('assessment_id', $assessment->id)],
        ]);
        $issued = $admin->issue($assessment, trim($data['name']), trim($data['position']), $data['unit_id'], $actor);

        return back()->with('selfAssessmentLink', ['name' => trim($data['name']), 'link' => $issued['link']]);
    }

    public function revoke(Request $request, Assessment $assessment, string $selfAssessment, SelfAssessmentAdmin $admin): RedirectResponse
    {
        $actor = $this->writerFor($this->pageRoles($request, $assessment, 'selfAssessments'), Resource::TokensAndParticipation);
        $admin->revoke($assessment, $selfAssessment, $actor);

        return back()->with('status', 'saved');
    }

    public function reissue(Request $request, Assessment $assessment, string $selfAssessment, SelfAssessmentAdmin $admin): RedirectResponse
    {
        $actor = $this->writerFor($this->pageRoles($request, $assessment, 'selfAssessments'), Resource::TokensAndParticipation);
        $link = $admin->reissue($assessment, $selfAssessment, $actor);
        $name = SelfAssessment::whereKey($selfAssessment)->value('respondent_name');

        return back()->with('selfAssessmentLink', ['name' => $name, 'link' => $link]);
    }
}
