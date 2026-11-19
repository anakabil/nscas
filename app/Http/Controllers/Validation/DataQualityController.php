<?php

namespace App\Http\Controllers\Validation;

use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Services\Quality\DataQualityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tinjauan mutu data sebelum validasi lapangan (docs/12 temuan T3): partisipasi per strata dengan alasan tertulis,
 * reliabilitas, kesepakatan dalam unit, dan jawaban bertanda. Dibaca asesor; diputuskan asesor utama.
 */
class DataQualityController extends ValidationStageController
{
    public function index(Request $request, Assessment $assessment, DataQualityService $quality): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'dataQuality');
        $lead = $this->isLead($roles);

        return Inertia::render('validation/data-quality', [
            ...$this->collectionCommon($assessment, $roles),
            'isLead' => $lead,
            'canReview' => $lead && DataQualityService::reviewOpen($assessment->status),
            'canExclude' => $lead && DataQualityService::exclusionOpen($assessment->status),
            'report' => $quality->report($assessment, true),
        ]);
    }

    public function exclusion(Request $request, Assessment $assessment, string $response, DataQualityService $quality): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'dataQuality');
        abort_unless($this->isLead($roles), 403);
        $data = $request->validate([
            'excluded' => ['required', 'boolean'],
            'reason' => ['nullable', 'required_if:excluded,true', 'string', 'min:5', 'max:500'],
        ]);
        $quality->setExclusion($assessment, $request->user(), Role::LeadAssessor, $response, (bool) $data['excluded'], trim((string) ($data['reason'] ?? '')));

        return back()->with('status', 'saved');
    }

    public function justify(Request $request, Assessment $assessment, DataQualityService $quality): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'dataQuality');
        abort_unless($this->isLead($roles), 403);
        $data = $request->validate([
            'stratumId' => ['required', 'string', 'max:26'],
            'justification' => ['required', 'string', 'min:20', 'max:2000'],
        ]);
        $quality->justify($assessment, $request->user(), Role::LeadAssessor, $data['stratumId'], trim($data['justification']));

        return back()->with('status', 'saved');
    }

    public function review(Request $request, Assessment $assessment, DataQualityService $quality): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'dataQuality');
        abort_unless($this->isLead($roles), 403);
        $data = $request->validate([
            'kind' => ['required', Rule::in(DataQualityService::REVIEW_KINDS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $note = trim((string) ($data['note'] ?? ''));
        $quality->review($assessment, $request->user(), Role::LeadAssessor, $data['kind'], $note === '' ? null : $note);

        return back()->with('status', 'saved');
    }
}
