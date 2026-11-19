<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Bobot tiga lapisan pada indeks karakteristik (docs/03 bagian 3). Bawaan 0,35; 0,40; 0,25. */
final readonly class LayerWeights
{
    public function __construct(
        public float $perception,
        public float $evidence,
        public float $validation,
    ) {}

    /** @return array{perception: float, evidence: float, validation: float} */
    public function toArray(): array
    {
        return [
            'perception' => $this->perception,
            'evidence' => $this->evidence,
            'validation' => $this->validation,
        ];
    }
}
