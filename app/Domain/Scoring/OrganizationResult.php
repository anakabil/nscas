<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Hasil tingkat organisasi (docs/03 bagian 4). Ini pengukuran internal, bukan sertifikat Safety Culture Ladder. */
final readonly class OrganizationResult
{
    /**
     * @param  float  $index  O, indeks organisasi 1,00 sampai 5,00.
     * @param  int  $indicativeLevel  L, 1 sampai 5.
     * @param  bool  $consolidated  Tingkat dinyatakan mantap.
     * @param  float  $gapToTarget  targetLevel - O
     * @param  string  $priorityAspect  Kode aspek dengan I_a terendah.
     * @param  float|null  $contextualIndex  Rata-rata nilai karakteristik kontekstual; null bila tidak ada.
     */
    public function __construct(
        public float $index,
        public int $indicativeLevel,
        public bool $consolidated,
        public float $minAspectIndex,
        public float $minCharacteristicIndex,
        public float $gapToTarget,
        public string $priorityAspect,
        public ?float $contextualIndex,
    ) {}

    /**
     * @return array{index: float, indicativeLevel: int, consolidated: bool, minAspectIndex: float,
     *     minCharacteristicIndex: float, gapToTarget: float, priorityAspect: string, contextualIndex: float|null}
     */
    public function toArray(): array
    {
        return [
            'index' => $this->index,
            'indicativeLevel' => $this->indicativeLevel,
            'consolidated' => $this->consolidated,
            'minAspectIndex' => $this->minAspectIndex,
            'minCharacteristicIndex' => $this->minCharacteristicIndex,
            'gapToTarget' => $this->gapToTarget,
            'priorityAspect' => $this->priorityAspect,
            'contextualIndex' => $this->contextualIndex,
        ];
    }
}
