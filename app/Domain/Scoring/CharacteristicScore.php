<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Skor satu karakteristik setelah aturan selisih persepsi dan bukti (docs/03 bagian 3). */
final readonly class CharacteristicScore
{
    /**
     * @param  float|null  $combined  G_c
     * @param  float|null  $divergence  |P_c - E_c|; null bila salah satu lapisan kosong.
     * @param  float|null  $final  F_c
     * @param  list<Flag>  $flags
     */
    public function __construct(
        public ?float $combined,
        public ?float $divergence,
        public ?float $final,
        public array $flags,
    ) {}

    /** @return array{combined: float|null, divergence: float|null, final: float|null, flags: list<string>} */
    public function toArray(): array
    {
        return [
            'combined' => $this->combined,
            'divergence' => $this->divergence,
            'final' => $this->final,
            'flags' => Flag::values($this->flags),
        ];
    }
}
