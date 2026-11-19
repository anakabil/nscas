<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/**
 * Fakta perencanaan satu asesmen yang dipakai pemeriksa syarat dan penghitung progres. Dikumpulkan layanan dari
 * basis data; kelas ini hanya membawa angka sehingga aturan di atasnya tetap murni dan dapat diuji.
 */
final readonly class SetupFacts
{
    public function __construct(
        public int $unitCount = 0,
        public int $strataCount = 0,
        public int $strataWithoutPopulation = 0,
        public bool $instrumentPublished = false,
        public int $leadAssessorCount = 0,
        public int $teamSize = 0,
        public bool $consentFilled = false,
        public bool $dpaSigned = false,
        public bool $samplePlanSaved = false,
        public bool $kickoffComplete = false,
        public bool $calibrationComplete = false,
        public int $workers = 0,
        public int $rosterCount = 0,
        public int $activeSurveyTokens = 0,
        public int $completedSurveys = 0,
    ) {}
}
