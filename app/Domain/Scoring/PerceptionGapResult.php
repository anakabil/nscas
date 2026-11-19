<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Kesenjangan persepsi manajemen dan pelaksana untuk satu aspek (docs/03 bagian 6). */
final readonly class PerceptionGapResult
{
    /**
     * @param  float|null  $management  Rata-rata skor survei kelompok Management; null bila disembunyikan.
     * @param  float|null  $field  Rata-rata skor survei kelompok Field; null bila disembunyikan.
     * @param  float|null  $gap  management dikurangi field; null bila disembunyikan.
     * @param  bool  $attention  Selisih mencapai perceptionGapAttention.
     * @param  bool  $suppressed  True bila salah satu kelompok memiliki kurang dari batas minimum respons.
     */
    public function __construct(
        public ?float $management,
        public ?float $field,
        public ?float $gap,
        public bool $attention,
        public bool $suppressed,
        public int $managementResponses,
        public int $fieldResponses,
    ) {}

    /**
     * @return array{management: float|null, field: float|null, gap: float|null, attention: bool, suppressed: bool,
     *     managementResponses: int, fieldResponses: int}
     */
    public function toArray(): array
    {
        return [
            'management' => $this->management,
            'field' => $this->field,
            'gap' => $this->gap,
            'attention' => $this->attention,
            'suppressed' => $this->suppressed,
            'managementResponses' => $this->managementResponses,
            'fieldResponses' => $this->fieldResponses,
        ];
    }
}
