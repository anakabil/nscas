<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Nilai bukti objektif (EvidenceRating) dari satu asesor untuk satu karakteristik: 1,0 sampai 5,0, kelipatan 0,5. */
final readonly class EvidenceRatingInput
{
    public function __construct(
        public string $characteristicCode,
        public int|string $assessorId,
        public float $level,
    ) {}
}
