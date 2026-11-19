<?php

declare(strict_types=1);

namespace App\Domain\Workflow;

use App\Domain\Access\Role;

/**
 * Siklus asesmen sebagai data (docs/01 bagian 3, disesuaikan docs/12 bagian 5). Murni: tanpa basis data.
 * Setiap transisi dijalankan oleh layanan asesmen yang memeriksa syaratnya dan mencatat jejak audit.
 */
final class Workflow
{
    /** @return list<Transition> */
    public static function transitions(): array
    {
        $lead = Role::LeadAssessor;

        return [
            new Transition(AssessmentStatus::Draft, AssessmentStatus::Configured, $lead, [
                'units_defined', 'strata_defined', 'strata_population_filled', 'instrument_selected', 'team_assigned',
            ]),
            // Kesiapan organisasi dan kalibrasi tim asesor ditambahkan pada rombak v2 (docs/12 temuan T2).
            new Transition(AssessmentStatus::Configured, AssessmentStatus::Locked, $lead, [
                'consent_text_filled', 'data_processing_agreement_recorded', 'sample_plan_calculated',
                'kickoff_communicated', 'assessors_calibrated',
            ]),
            new Transition(AssessmentStatus::Locked, AssessmentStatus::DataCollection, $lead, [
                'roster_imported', 'tokens_issued',
            ]),
            // Gerbang mutu data sebelum validasi lapangan (docs/12 temuan T3).
            new Transition(AssessmentStatus::DataCollection, AssessmentStatus::Validation, $lead, [
                'survey_closed', 'participation_reviewed', 'data_quality_reviewed', 'validation_plan_set',
            ]),
            new Transition(AssessmentStatus::Validation, AssessmentStatus::Scoring, $lead, [
                'validation_sessions_completed', 'evidence_reviewed',
            ]),
            new Transition(AssessmentStatus::Scoring, AssessmentStatus::PanelReview, $lead, [
                'two_assessor_ratings', 'score_run_saved',
            ]),
            new Transition(AssessmentStatus::PanelReview, AssessmentStatus::ActionPlanning, $lead, [
                'panel_adjustments_justified', 'results_locked',
            ]),
            new Transition(AssessmentStatus::ActionPlanning, AssessmentStatus::Reported, $lead, [
                'final_report_signed',
            ]),
            // Hasil dikembalikan kepada pekerja yang menjadi sumber data (docs/12 temuan T5).
            new Transition(AssessmentStatus::Reported, AssessmentStatus::Monitoring, $lead, [
                'action_plan_published', 'results_communicated',
            ]),
            new Transition(AssessmentStatus::Monitoring, AssessmentStatus::Archived, $lead, [
                'monitoring_closed',
            ]),
            new Transition(AssessmentStatus::Archived, AssessmentStatus::Purged, Role::SuperAdmin, [
                'retention_expired', 'destruction_record_created',
            ]),
        ];
    }

    /** Transisi berikutnya dari status ini; null pada status terakhir. */
    public static function next(AssessmentStatus $status): ?Transition
    {
        foreach (self::transitions() as $transition) {
            if ($transition->from === $status) {
                return $transition;
            }
        }

        return null;
    }

    /** Siklus hanya maju satu langkah; tidak ada lompatan dan tidak ada langkah mundur. */
    public static function canTransition(AssessmentStatus $from, AssessmentStatus $to): bool
    {
        return self::next($from)?->to === $to;
    }
}
