<?php

namespace App\Http\Controllers\Scoring;

use App\Domain\Panel\PanelRules;
use App\Models\Assessment;
use App\Services\Scoring\ScoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Rapat panel (docs/01 M8): setiap karakteristik bertanda diputuskan dengan alasan tertulis, lalu hasil ditetapkan
 * dan dikunci. Dibaca asesor; diputuskan asesor utama (matriks docs/04 baris "Panel dan finalisasi").
 */
class PanelController extends RatingStageController
{
    public function index(Request $request, Assessment $assessment, ScoringService $scoring): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'panel');

        return Inertia::render('scoring/panel', [
            ...$this->collectionCommon($assessment, $roles),
            'canDecide' => $this->isLead($roles) && PanelRules::panelOpen($assessment->status),
            'isLead' => $this->isLead($roles),
            'rationaleMin' => PanelRules::RATIONALE_MIN,
            'panel' => $scoring->panel($assessment),
        ]);
    }

    public function decide(Request $request, Assessment $assessment, string $code, ScoringService $scoring): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'panel');
        abort_unless($this->isLead($roles), 403);
        $data = $request->validate([
            'kind' => ['required', Rule::in(['ADJUSTED', 'CONFIRMED'])],
            'value' => ['nullable', 'required_if:kind,ADJUSTED', 'numeric', 'between:1,5'],
            'rationale' => ['required', 'string', 'min:'.PanelRules::RATIONALE_MIN, 'max:4000'],
        ]);
        $scoring->decide($assessment, $request->user(), $this->assessorRole($roles), $code, $data['kind'],
            $data['kind'] === 'ADJUSTED' ? (float) $data['value'] : null, trim($data['rationale']));

        return back()->with('status', 'saved');
    }

    public function withdraw(Request $request, Assessment $assessment, string $code, ScoringService $scoring): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'panel');
        abort_unless($this->isLead($roles), 403);
        $scoring->withdraw($assessment, $this->assessorRole($roles), $code);

        return back()->with('status', 'saved');
    }

    public function finalize(Request $request, Assessment $assessment, ScoringService $scoring): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'panel');
        abort_unless($this->isLead($roles), 403);
        $scoring->finalize($assessment, $request->user(), $this->assessorRole($roles));

        return back()->with('status', 'finalized');
    }
}
