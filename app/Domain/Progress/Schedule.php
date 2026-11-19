<?php

declare(strict_types=1);

namespace App\Domain\Progress;

/** Posisi hari ini terhadap periode asesmen. */
final readonly class Schedule
{
    /**
     * @param  'notStarted'|'running'|'ended'  $phase
     * @param  float  $elapsed  Bagian periode yang telah berjalan, 0 sampai 1.
     * @param  int  $daysRemaining  Hari menuju akhir periode; negatif bila sudah lewat.
     */
    public function __construct(
        public string $phase,
        public float $elapsed,
        public int $daysRemaining,
        public int $totalDays,
    ) {}
}
