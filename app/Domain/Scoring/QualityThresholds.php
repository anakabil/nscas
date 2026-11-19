<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Ambang tanda mutu jawaban; nilainya dari bagian quality pada snapshot parameter asesmen. */
final readonly class QualityThresholds
{
    /**
     * @param  float  $straightliningShare  PolaSeragam bila porsi nilai terbanyak pada skala iklim >= ambang (bawaan 0,90).
     * @param  float  $speedingFractionOfMedian  TerlaluCepat bila durasi < pecahan ini x median durasi asesmen (bawaan 0,33).
     * @param  float  $dontKnowShareMax  BanyakTidakTahu bila porsi "Tidak tahu" > ambang (bawaan 0,50).
     */
    public function __construct(
        public float $straightliningShare,
        public float $speedingFractionOfMedian,
        public float $dontKnowShareMax,
    ) {}
}
