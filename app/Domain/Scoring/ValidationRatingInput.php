<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Nilai satu asesor pada satu sesi validasi (wawancara atau diskusi kelompok terarah) untuk satu karakteristik. */
final readonly class ValidationRatingInput
{
    public function __construct(
        public int|string $sessionId,
        public string $characteristicCode,
        public int|string $assessorId,
        public float $level,
    ) {}
}
