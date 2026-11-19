<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Status penilaian mandiri manajemen. Hanya Submitted yang masuk skor persepsi (docs/03 bagian 2.1). */
enum SelfAssessmentStatus: string
{
    case Draft = 'DRAFT';
    case Submitted = 'SUBMITTED';
}
