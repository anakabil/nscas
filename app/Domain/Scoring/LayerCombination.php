<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Indeks gabungan G_c beserta tanda kelengkapan lapisan (docs/03 bagian 3). */
final readonly class LayerCombination
{
    /**
     * @param  float|null  $combined  G_c; null bila semua lapisan kosong.
     * @param  list<Flag>  $flags
     */
    public function __construct(
        public ?float $combined,
        public array $flags,
    ) {}

    /** @return array{combined: float|null, flags: list<string>} */
    public function toArray(): array
    {
        return ['combined' => $this->combined, 'flags' => Flag::values($this->flags)];
    }
}
