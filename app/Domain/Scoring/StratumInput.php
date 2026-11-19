<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Satu strata responden dengan populasinya (bobot w_s pada skor survei). */
final readonly class StratumInput
{
    public function __construct(
        public string $code,
        public StratumGroup $group,
        public int $population,
    ) {}
}
