<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Keluaran kalkulator sampel (docs/03 bagian 7). Bentuknya sama dengan seed/fixtures/sampel-3000.json. */
final readonly class SamplePlan
{
    /**
     * @param  array{M: int, projects: int, locations: int, z: float, e: float, p: float, minParticipation: float}  $inputs
     * @param  int  $sclMinimumInterviewManagement  Wawancara minimum manajemen dan staf.
     * @param  int  $sclMinimumInterviewOperational  Wawancara minimum pekerja operasional.
     * @param  float  $cochranInitial  n0 sebelum koreksi populasi terhingga.
     * @param  int  $recommendedSurvey  max(Slovin, Cochran terkoreksi).
     * @param  list<array<string, mixed>>  $strata  Strata masukan apa adanya ditambah proportion (float) dan surveyTarget (int).
     */
    public function __construct(
        public array $inputs,
        public int $sclMinimumInterviewManagement,
        public int $sclMinimumInterviewOperational,
        public int $sclMinimumInterviewTotal,
        public int $slovin,
        public float $cochranInitial,
        public int $cochranCorrected,
        public int $recommendedSurvey,
        public int $projectsToVisit,
        public int $locationsToVisit,
        public array $strata,
        public int $surveyTargetTotal,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'inputs' => $this->inputs,
            'sclMinimumInterviewManagement' => $this->sclMinimumInterviewManagement,
            'sclMinimumInterviewOperational' => $this->sclMinimumInterviewOperational,
            'sclMinimumInterviewTotal' => $this->sclMinimumInterviewTotal,
            'slovin' => $this->slovin,
            'cochranInitial' => $this->cochranInitial,
            'cochranCorrected' => $this->cochranCorrected,
            'recommendedSurvey' => $this->recommendedSurvey,
            'projectsToVisit' => $this->projectsToVisit,
            'locationsToVisit' => $this->locationsToVisit,
            'strata' => $this->strata,
            'surveyTargetTotal' => $this->surveyTargetTotal,
        ];
    }
}
