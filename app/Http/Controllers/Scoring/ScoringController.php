<?php

namespace App\Http\Controllers\Scoring;

use App\Domain\Panel\PanelRules;
use App\Domain\Validation\ValidationRules;
use App\Models\Assessment;
use App\Services\Findings\FindingsService;
use App\Services\Scoring\ScoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Penilaian asesor (docs/01 M8): nilai bukti per karakteristik oleh setiap asesor tanpa melihat nilai rekan sebelum
 * menyimpan, jalur setara oleh asesor utama, dan eksekusi mesin penilaian.
 */
class ScoringController extends RatingStageController
{
    public function index(Request $request, Assessment $assessment, ScoringService $scoring): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'scoring');
        $lead = $this->isLead($roles);
        $runs = $scoring->runs($assessment);
        $changed = $scoring->lastInputChange($assessment);

        return Inertia::render('scoring/index', [
            ...$this->collectionCommon($assessment, $roles),
            'canRate' => PanelRules::ratingOpen($assessment->status),
            'canRun' => $lead && PanelRules::runOpen($assessment->status),
            'isLead' => $lead,
            'rows' => $scoring->overview($assessment, $request->user()),
            'scl' => $scoring->scl($assessment),
            'runs' => $runs,
            'stale' => $runs !== [] && $changed !== null && $changed->greaterThan($runs[0]['createdAt']),
        ]);
    }

    public function show(Request $request, Assessment $assessment, string $code, ScoringService $scoring, FindingsService $findings): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'scoring');
        $row = collect($findings->build($assessment)['characteristics'])->firstWhere('code', $code);
        $workspace = $scoring->workspace($assessment, $code, $request->user(), $row === null ? [] : [
            'survey' => $row['survey'],
            'answered' => $row['answered'],
            'dontKnowShare' => $row['dontKnowShare'],
            'groups' => $row['groups'],
            'selfAssessment' => $row['selfAssessment'],
        ]);
        abort_if($workspace === null, 404);

        return Inertia::render('scoring/characteristic', [
            ...$this->collectionCommon($assessment, $roles),
            'canRate' => PanelRules::ratingOpen($assessment->status),
            'ratingLevels' => ValidationRules::RATING_LEVELS,
            'rationaleMin' => PanelRules::RATIONALE_MIN,
            'characteristic' => $workspace,
            'codes' => array_column($scoring->overview($assessment, $request->user()), 'code'),
        ]);
    }

    public function rate(Request $request, Assessment $assessment, string $characteristic, ScoringService $scoring): RedirectResponse
    {
        $actor = $this->assessorRole($this->pageRoles($request, $assessment, 'scoring'));
        $data = $request->validate([
            'level' => ['required', 'numeric', 'between:1,5'],
            'rationale' => ['required', 'string', 'min:'.PanelRules::RATIONALE_MIN, 'max:4000'],
            'evidenceIds' => ['present', 'array', 'max:200'],
            'evidenceIds.*' => ['string', 'max:26'],
            'observationIds' => ['present', 'array', 'max:200'],
            'observationIds.*' => ['string', 'max:26'],
        ]);
        $scoring->saveRating($assessment, $request->user(), $actor, $characteristic, (float) $data['level'], trim($data['rationale']), $data['evidenceIds'], $data['observationIds']);

        return back()->with('status', 'saved');
    }

    public function scl(Request $request, Assessment $assessment, string $aspect, ScoringService $scoring): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'scoring');
        abort_unless($this->isLead($roles), 403);
        $data = $request->validate([
            'entries' => ['required', 'array', 'size:4'],
            'entries.*.step' => ['required', 'integer', 'between:2,5', 'distinct'],
            'entries.*.percent' => ['required', 'numeric', 'between:0,100'],
            'entries.*.justification' => ['required', 'string', 'min:'.PanelRules::SCL_JUSTIFICATION_MIN, 'max:2000'],
        ]);
        $scoring->saveScl($assessment, $request->user(), $this->assessorRole($roles), $aspect, array_map(fn (array $e) => [
            'step' => (int) $e['step'], 'percent' => round((float) $e['percent'], 2), 'justification' => trim($e['justification']),
        ], $data['entries']));

        return back()->with('status', 'saved');
    }

    public function run(Request $request, Assessment $assessment, ScoringService $scoring): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'scoring');
        abort_unless($this->isLead($roles), 403);
        $scoring->run($assessment, $request->user(), $this->assessorRole($roles));

        return back()->with('status', 'scoreRun');
    }
}
