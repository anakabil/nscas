<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Ambang kelulusan satu tingkat (2 sampai 5) pada jalur setara (docs/03 bagian 5). */
final readonly class SclThreshold
{
    /**
     * @param  int  $step  Tingkat 2, 3, 4, atau 5.
     * @param  float  $minWeightedAverage  Ambang rata-rata tertimbang, rentang 0 sampai 1.
     * @param  float  $minPerAspect  Ambang minimum setiap aspek, rentang 0 sampai 1.
     */
    public function __construct(
        public int $step,
        public float $minWeightedAverage,
        public float $minPerAspect,
    ) {}
}
