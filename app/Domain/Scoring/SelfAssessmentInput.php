<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Satu penilaian mandiri manajemen. Hanya yang berstatus Submitted dihitung. */
final readonly class SelfAssessmentInput
{
    /**
     * @param  array<string, int|float|null>  $answers  Kode karakteristik ke tingkat 1 sampai 5; null atau tidak ada berarti tidak dinilai.
     */
    public function __construct(
        public SelfAssessmentStatus $status,
        public array $answers,
    ) {}
}
