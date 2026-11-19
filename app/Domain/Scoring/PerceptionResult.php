<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Hasil lapisan persepsi satu karakteristik (docs/03 bagian 2.1). */
final readonly class PerceptionResult
{
    /**
     * @param  float|null  $survey  S_c, skor survei berbobot populasi strata; null bila tidak ada jawaban.
     * @param  float|null  $selfAssessment  A_c, rata-rata penilaian mandiri; null bila tidak ada.
     * @param  float|null  $perception  P_c; null bila skor survei kosong.
     */
    public function __construct(
        public ?float $survey,
        public ?float $selfAssessment,
        public ?float $perception,
    ) {}

    /** @return array{survey: float|null, selfAssessment: float|null, perception: float|null} */
    public function toArray(): array
    {
        return [
            'survey' => $this->survey,
            'selfAssessment' => $this->selfAssessment,
            'perception' => $this->perception,
        ];
    }
}
