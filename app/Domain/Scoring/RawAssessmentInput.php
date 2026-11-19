<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/**
 * Data mentah satu asesmen untuk ScoringEngine::scoreAssessment(). Pemanggil wajib sudah menyaring
 * data per organisasi dan per asesmen (CLAUDE.md aturan 4); mesin tidak mengenal tenant.
 */
final readonly class RawAssessmentInput
{
    /**
     * @param  list<CharacteristicDefinition>  $characteristics
     * @param  list<StratumInput>  $strata
     * @param  list<SurveyResponseInput>  $surveyResponses
     * @param  list<SelfAssessmentInput>  $selfAssessments
     * @param  list<EvidenceRatingInput>  $evidenceRatings
     * @param  list<ValidationRatingInput>  $validationRatings
     * @param  array<string, int|float>  $panelAdjustments  Kode karakteristik ke PanelAdjustment.adjustedValue.
     * @param  array<string, array<int, int|float>>|null  $sclFulfillment  Lihat EngineInput.
     */
    public function __construct(
        public array $characteristics,
        public array $strata,
        public array $surveyResponses,
        public array $selfAssessments,
        public array $evidenceRatings,
        public array $validationRatings,
        public float $targetLevel,
        public array $panelAdjustments = [],
        public ?array $sclFulfillment = null,
    ) {}
}
