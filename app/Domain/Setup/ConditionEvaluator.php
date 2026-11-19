<?php

declare(strict_types=1);

namespace App\Domain\Setup;

use App\Domain\Workflow\Transition;

/**
 * Pemeriksa syarat transisi status (docs/01 bagian 3, App\Domain\Workflow\Workflow). Fase R1 memeriksa syarat tahap
 * perencanaan, fase R2 syarat dimulainya pengumpulan data, fase R6 gerbang mutu data dan validasi, fase R7 penilaian
 * dan rapat panel; syarat tahap lain
 * bernilai null sampai modulnya dibangun.
 */
final class ConditionEvaluator
{
    /** Halaman tempat setiap syarat dipenuhi (kunci modul pada ModuleCatalog). */
    public const MODULE_OF = [
        'units_defined' => 'units',
        'strata_defined' => 'strata',
        'strata_population_filled' => 'strata',
        'instrument_selected' => 'details',
        'team_assigned' => 'team',
        'consent_text_filled' => 'parameters',
        'data_processing_agreement_recorded' => 'parameters',
        'sample_plan_calculated' => 'sampling',
        'kickoff_communicated' => 'kickoff',
        'assessors_calibrated' => 'kickoff',
        'roster_imported' => 'respondents',
        'tokens_issued' => 'respondents',
        'survey_closed' => 'respondents',
        'participation_reviewed' => 'dataQuality',
        'self_assessments_submitted' => 'selfAssessments',
        'data_quality_reviewed' => 'dataQuality',
        'validation_plan_set' => 'validation',
        'validation_sessions_completed' => 'validation',
        'site_visit_completed' => 'validation',
        'evidence_reviewed' => 'evidence',
        'two_assessor_ratings' => 'scoring',
        'score_run_saved' => 'scoring',
        'panel_adjustments_justified' => 'panel',
        'results_locked' => 'panel',
        'final_report_signed' => 'report',
        'action_plan_published' => 'gaps',
        'results_communicated' => 'communication',
        'monitoring_closed' => 'monitoring',
    ];

    /**
     * Tim asesor minimal dua orang: setiap karakteristik kelak dinilai dua asesor (syarat two_assessor_ratings),
     * sejalan dengan skema Safety Culture Ladder yang memakai dua auditor (docs/13 bagian 3).
     */
    public const MIN_TEAM_SIZE = 2;

    /** @return list<ConditionResult> */
    public static function evaluate(Transition $transition, SetupFacts $facts): array
    {
        return array_map(
            static fn (string $key): ConditionResult => new ConditionResult($key, self::check($key, $facts), self::MODULE_OF[$key] ?? null),
            $transition->conditions,
        );
    }

    /** true atau false bila dapat diperiksa; null bila modulnya belum dibangun. */
    public static function check(string $key, SetupFacts $facts): ?bool
    {
        return match ($key) {
            'units_defined' => $facts->unitCount >= 1,
            'strata_defined' => $facts->strataCount >= 1,
            'strata_population_filled' => $facts->strataCount >= 1 && $facts->strataWithoutPopulation === 0,
            'instrument_selected' => $facts->instrumentPublished,
            'team_assigned' => $facts->leadAssessorCount >= 1 && $facts->teamSize >= self::MIN_TEAM_SIZE,
            'consent_text_filled' => $facts->consentFilled,
            'data_processing_agreement_recorded' => $facts->dpaSigned,
            'sample_plan_calculated' => $facts->samplePlanSaved,
            'kickoff_communicated' => $facts->kickoffComplete,
            'assessors_calibrated' => $facts->calibrationComplete,
            'roster_imported' => $facts->rosterCount >= 1,
            'tokens_issued' => $facts->activeSurveyTokens >= 1,
            'survey_closed' => $facts->surveyClosed,
            'participation_reviewed' => $facts->participationReviewed,
            // Paling sedikit satu terkirim, dan tidak ada tautan aktif yang belum dikirim (keputusan R4).
            'self_assessments_submitted' => $facts->selfAssessmentsSubmitted >= 1 && $facts->selfAssessmentsPending === 0,
            'data_quality_reviewed' => $facts->dataQualityReviewed,
            'validation_plan_set' => $facts->validationPlanSet,
            'validation_sessions_completed' => $facts->validationSessionsCompleted,
            'site_visit_completed' => $facts->siteVisitCompleted,
            'evidence_reviewed' => $facts->characteristicCount >= 1 && $facts->characteristicsReviewed >= $facts->characteristicCount,
            'two_assessor_ratings' => $facts->twoAssessorRatings,
            // Eksekusi terakhir dibuat setelah perubahan terakhir pada data masukan.
            'score_run_saved' => $facts->scoreRunCurrent,
            'panel_adjustments_justified' => $facts->panelDecisionsComplete,
            'results_locked' => $facts->resultsLocked,
            default => null,
        };
    }

    /**
     * Transisi boleh dijalankan hanya bila semua syarat terbukti terpenuhi.
     *
     * @param  list<ConditionResult>  $results
     */
    public static function allowed(array $results): bool
    {
        foreach ($results as $result) {
            if ($result->met !== true) {
                return false;
            }
        }

        return true;
    }
}
