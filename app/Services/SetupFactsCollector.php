<?php

namespace App\Services;

use App\Domain\Access\Role;
use App\Domain\Panel\PanelRules;
use App\Domain\Setup\DpaStatus;
use App\Domain\Setup\Kickoff;
use App\Domain\Setup\SetupFacts;
use App\Domain\Validation\SessionProposal;
use App\Domain\Validation\ValidationRules;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\AssessmentReview;
use App\Models\EvidenceRating;
use App\Models\EvidenceReview;
use App\Models\ObservationWindow;
use App\Models\ScoreRun;
use App\Models\SelfAssessment;
use App\Models\StratumJustification;
use App\Models\ValidationSession;
use App\Services\Evidence\EvidenceService;
use App\Services\Respondents\ParticipationReport;
use App\Services\Scoring\ScoringService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Mengumpulkan fakta perencanaan dari basis data untuk pemeriksa syarat dan dasbor progres. Untuk banyak asesmen
 * sekaligus (dasbor), hitungan dimuat dengan satu kueri per jenis, bukan per asesmen.
 */
final class SetupFactsCollector
{
    public static function for(Assessment $assessment): SetupFacts
    {
        return self::forMany(new Collection([$assessment]))[$assessment->id];
    }

    /**
     * @param  Collection<int, Assessment>  $assessments
     * @return array<string, SetupFacts>
     */
    public static function forMany(Collection $assessments): array
    {
        if ($assessments->isEmpty()) {
            return [];
        }
        $assessments->loadCount([
            'units',
            'units as project_units_count' => fn ($q) => $q->where('type', 'PROJECT'),
            'strata',
            'strata as strata_without_population_count' => fn ($q) => $q->where('population', '<=', 0),
            'roster',
            // Hanya hitungan dari token, tidak pernah dari tabel jawaban (docs/02 bagian 4).
            'tokens as active_survey_tokens_count' => fn ($q) => $q->where('kind', 'SURVEY')->whereNull('revoked_at'),
            'tokens as completed_surveys_count' => fn ($q) => $q->where('kind', 'SURVEY')->whereNotNull('completed_at'),
            'selfAssessments',
            'selfAssessments as self_assessments_submitted_count' => fn ($q) => $q->where('status', 'SUBMITTED'),
        ]);
        $assessments->loadSum('strata as strata_population_sum', 'population');
        $assessments->loadMissing(['team', 'instrumentVersion', 'strata']);
        // Survei selesai per strata untuk semua asesmen sekaligus, dari token (bukan dari jawaban).
        $completedByStratum = AccessToken::whereIn('assessment_id', $assessments->modelKeys())
            ->where('kind', 'SURVEY')->whereNotNull('completed_at')->whereNotNull('stratum_id')
            ->selectRaw('stratum_id, count(*) as n')->groupBy('stratum_id')->pluck('n', 'stratum_id');

        // Fase R5: proyek yang sudah memiliki rekaman observasi, dan kelengkapan jenis bukti per karakteristik.
        $observedProjects = ObservationWindow::whereIn('assessment_id', $assessments->modelKeys())->whereHas('captures')
            ->selectRaw('assessment_id, count(distinct unit_id) as n')->groupBy('assessment_id')->pluck('n', 'assessment_id');
        $evidence = app(EvidenceService::class);

        // Fase R6: tinjauan, alasan strata, penilaian mandiri yang belum terkirim, sesi validasi, dan tinjauan bukti.
        $ids = $assessments->modelKeys();
        $reviews = AssessmentReview::whereIn('assessment_id', $ids)->get(['assessment_id', 'kind'])->groupBy('assessment_id');
        $justified = StratumJustification::whereIn('assessment_id', $ids)->pluck('stratum_id')->flip();
        $pendingSelf = SelfAssessment::whereIn('assessment_id', $ids)->where('status', '!=', 'SUBMITTED')
            ->whereHas('accessToken', fn ($q) => $q->whereNull('revoked_at'))
            ->selectRaw('assessment_id, count(*) as n')->groupBy('assessment_id')->pluck('n', 'assessment_id');
        $sessions = ValidationSession::whereIn('assessment_id', $ids)->withCount('ratings')
            ->get(['id', 'assessment_id', 'type', 'status', 'focus_characteristic_ids'])->groupBy('assessment_id');
        $reviewedEvidence = EvidenceReview::whereIn('assessment_id', $ids)
            ->selectRaw('assessment_id, count(*) as n')->groupBy('assessment_id')->pluck('n', 'assessment_id');
        $minParticipation = [];
        // Fase R7: nilai bukti per karakteristik dan asesor, serta eksekusi mesin terakhir dan final.
        $evidenceRatings = EvidenceRating::whereIn('assessment_id', $ids)->get(['assessment_id', 'characteristic_id', 'assessor_id'])->groupBy('assessment_id');
        $runs = ScoreRun::whereIn('assessment_id', $ids)->with('decisions:id,score_run_id,characteristic_code,rationale')
            ->orderByDesc('created_at')->get(['id', 'assessment_id', 'created_at', 'is_final', 'result'])->groupBy('assessment_id');
        $characteristicIds = DB::table('characteristics')->whereIn('instrument_version_id', $assessments->pluck('instrument_version_id')->filter()->unique())
            ->get(['id', 'instrument_version_id'])->groupBy('instrument_version_id');
        $scoring = app(ScoringService::class);

        $facts = [];
        foreach ($assessments as $assessment) {
            $checklist = $assessment->status->parametersLocked() ? $evidence->checklist($assessment, null)['rows'] : [];
            $team = $assessment->team;
            $draft = $assessment->parameter_draft ?? [];
            $minParticipation[$assessment->id] = ParticipationReport::thresholds($assessment)[1];
            $below = $assessment->strata->filter(fn ($s) => $s->population > 0
                && ((int) ($completedByStratum[$s->id] ?? 0)) / $s->population < $minParticipation[$assessment->id]);
            $kinds = ($reviews[$assessment->id] ?? collect())->pluck('kind')->all();
            $ownSessions = ($sessions[$assessment->id] ?? collect())->map(fn ($s) => [
                'type' => $s->type, 'status' => $s->status, 'focus' => count($s->focus_characteristic_ids), 'ratings' => (int) $s->ratings_count,
            ])->values()->all();
            $ownRuns = $runs[$assessment->id] ?? collect();
            $latest = $ownRuns->first();
            $final = $ownRuns->firstWhere('is_final', true);
            $changed = $latest !== null && $assessment->status->position() <= AssessmentStatus::Scoring->position() ? $scoring->lastInputChange($assessment) : null;
            $facts[$assessment->id] = new SetupFacts(
                unitCount: (int) $assessment->units_count,
                strataCount: (int) $assessment->strata_count,
                strataWithoutPopulation: (int) $assessment->strata_without_population_count,
                instrumentPublished: (bool) $assessment->instrumentVersion?->isPublished(),
                leadAssessorCount: $team->where('role', Role::LeadAssessor)->count(),
                teamSize: $team->count(),
                consentFilled: trim((string) $assessment->consent_text_id) !== '',
                dpaSigned: $assessment->dpa_status === DpaStatus::Signed,
                samplePlanSaved: ! empty($draft['samplePlan']) || ! empty($assessment->parameter_snapshot['samplePlan'] ?? null),
                kickoffComplete: Kickoff::isComplete($assessment->kickoff),
                calibrationComplete: Kickoff::calibrationComplete(
                    $assessment->calibration,
                    $team->pluck('user_id')->map(fn ($id) => (int) $id)->values()->all(),
                ),
                workers: (int) $assessment->strata_population_sum,
                rosterCount: (int) $assessment->roster_count,
                activeSurveyTokens: (int) $assessment->active_survey_tokens_count,
                completedSurveys: (int) $assessment->completed_surveys_count,
                strataBelowMinimum: $below->count(),
                selfAssessmentsIssued: (int) $assessment->self_assessments_count,
                selfAssessmentsSubmitted: (int) $assessment->self_assessments_submitted_count,
                characteristicsWithEvidence: count(array_filter($checklist, fn (array $row) => ! $row['belowMinimum'])),
                characteristicCount: count($checklist),
                projectCount: (int) $assessment->project_units_count,
                projectsObserved: (int) ($observedProjects[$assessment->id] ?? 0),
                surveyClosed: $assessment->survey_closes_at !== null && $assessment->survey_closes_at->lessThanOrEqualTo(now()),
                participationReviewed: in_array('PARTICIPATION', $kinds, true) && $below->every(fn ($s) => $justified->has($s->id)),
                selfAssessmentsPending: (int) ($pendingSelf[$assessment->id] ?? 0),
                dataQualityReviewed: in_array('DATA_QUALITY', $kinds, true),
                validationPlanSet: ValidationRules::planSet($ownSessions),
                validationSessionsCompleted: ValidationRules::sessionsCompleted($ownSessions),
                siteVisitCompleted: array_filter($ownSessions, fn (array $s) => $s['type'] === SessionProposal::SITE_VISIT && $s['status'] === 'COMPLETED') !== [],
                characteristicsReviewed: (int) ($reviewedEvidence[$assessment->id] ?? 0),
                twoAssessorRatings: PanelRules::twoAssessorsComplete(
                    ($characteristicIds[$assessment->instrument_version_id] ?? collect())->pluck('id')->all(),
                    ($evidenceRatings[$assessment->id] ?? collect())->map(fn ($r) => ['characteristicId' => $r->characteristic_id, 'assessorId' => $r->assessor_id])->all(),
                ),
                scoreRunCurrent: $latest !== null && ($changed === null || $latest->created_at->greaterThanOrEqualTo($changed)),
                panelDecisionsComplete: ($final ?? $latest) !== null && PanelRules::decisionsComplete(
                    PanelRules::needsDecision(($final ?? $latest)->result['characteristics'] ?? []),
                    ($final ?? $latest)->decisions->pluck('rationale', 'characteristic_code')->all(),
                ),
                resultsLocked: $final !== null,
            );
        }

        return $facts;
    }
}
