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
        public int $strataBelowMinimum = 0,
        public int $selfAssessmentsIssued = 0,
        public int $selfAssessmentsSubmitted = 0,
        // Fase R5: karakteristik yang memenuhi ambang jenis bukti, dan proyek yang sudah memiliki rekaman observasi.
        public int $characteristicsWithEvidence = 0,
        public int $characteristicCount = 0,
        public int $projectCount = 0,
        public int $projectsObserved = 0,
        // Fase R6: gerbang mutu data dan validasi lapangan.
        public bool $surveyClosed = false,
        public bool $participationReviewed = false,
        public int $selfAssessmentsPending = 0,
        public bool $dataQualityReviewed = false,
        public bool $validationPlanSet = false,
        public bool $validationSessionsCompleted = false,
        public bool $siteVisitCompleted = false,
        public int $characteristicsReviewed = 0,
        // Fase R7: nilai dua asesor, eksekusi mesin yang mutakhir, keputusan panel, dan hasil terkunci.
        public bool $twoAssessorRatings = false,
        public bool $scoreRunCurrent = false,
        public bool $panelDecisionsComplete = false,
        public bool $resultsLocked = false,
        // Fase R9: rencana aksi terbit dan pemantauan selesai.
        public bool $actionPlanPublished = false,
        public bool $monitoringClosed = false,
        // Fase R10: laporan lengkap ditandatangani dan hasil dikomunikasikan kepada pekerja.
        public bool $finalReportSigned = false,
        public bool $resultsCommunicated = false,
        // Fase R11: masa simpan data mentah berakhir dan berita acara pemusnahan dibuat.
        public bool $retentionExpired = false,
        public bool $destructionRecorded = false,
    ) {}
}
