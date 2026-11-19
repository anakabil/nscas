<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Hasil agregasi satu aspek (docs/03 bagian 4). */
final readonly class AspectResult
{
    /**
     * @param  float  $index  I_a, rata-rata nilai karakteristik non-kontekstual dalam aspek.
     * @param  float  $min  Nilai karakteristik terendah dalam aspek.
     * @param  float  $weight  W_a
     * @param  float  $gapToTarget  targetLevel - I_a
     */
    public function __construct(
        public float $index,
        public float $min,
        public float $weight,
        public float $gapToTarget,
    ) {}

    /** @return array{index: float, min: float, weight: float, gapToTarget: float} */
    public function toArray(): array
    {
        return [
            'index' => $this->index,
            'min' => $this->min,
            'weight' => $this->weight,
            'gapToTarget' => $this->gapToTarget,
        ];
    }
}
