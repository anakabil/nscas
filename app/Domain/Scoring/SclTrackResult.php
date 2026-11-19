<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/**
 * Hasil jalur setara (docs/03 bagian 5). Tingkat indikatif di sini adalah diagnosis internal,
 * bukan sertifikat Safety Culture Ladder.
 */
final readonly class SclTrackResult
{
    /**
     * @param  array<int, SclStepResult>  $steps  Berkunci tingkat 2, 3, 4, 5.
     * @param  int  $indicativeLevel  Tingkat tertinggi yang lulus berurutan; 1 bila tingkat 2 gagal.
     */
    public function __construct(
        public array $steps,
        public int $indicativeLevel,
    ) {}

    /** @return array{steps: array<int, array<string, float|bool>>, indicativeLevel: int} */
    public function toArray(): array
    {
        return [
            'steps' => array_map(static fn (SclStepResult $step): array => $step->toArray(), $this->steps),
            'indicativeLevel' => $this->indicativeLevel,
        ];
    }
}
