<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Kelompok strata responden. Kesenjangan persepsi (docs/03 bagian 6) membandingkan Management dengan Field. */
enum StratumGroup: string
{
    case Management = 'MANAGEMENT';
    case Supervisory = 'SUPERVISORY';
    case Field = 'FIELD';
}
