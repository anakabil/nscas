<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Hasil lapisan bukti objektif satu karakteristik (docs/03 bagian 2.2). */
final readonly class EvidenceLayerResult
{
    /**
     * @param  float|null  $value  E_c; null bila belum ada penilaian.
     * @param  list<Flag>  $flags  PenilaiTunggal dan atau PerluRekonsiliasi.
     */
    public function __construct(
        public ?float $value,
        public array $flags,
    ) {}

    /** @return array{value: float|null, flags: list<string>} */
    public function toArray(): array
    {
        return ['value' => $this->value, 'flags' => Flag::values($this->flags)];
    }
}
