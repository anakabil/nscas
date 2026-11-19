<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Satu jawaban survei dalam bentuk yang diperlukan pemeriksaan tanda mutu. */
final readonly class ResponseForQuality
{
    /**
     * @param  list<int|float>  $climateValues  Jawaban skala iklim.
     * @param  list<int|float|null>  $characteristicLevels  Jawaban karakteristik; null berarti "Tidak tahu".
     * @param  float|null  $durationMinutes  Durasi tepat dari peramban; hanya dipakai saat jawaban dikirim dan tidak pernah disimpan.
     */
    public function __construct(
        public array $climateValues,
        public array $characteristicLevels,
        public ?float $durationMinutes,
    ) {}
}
