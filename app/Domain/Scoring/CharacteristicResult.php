<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Hasil mesin untuk satu karakteristik (docs/03 bagian 9). */
final readonly class CharacteristicResult
{
    /**
     * @param  float|null  $combined  G_c
     * @param  float|null  $divergence  |P_c - E_c|
     * @param  float|null  $final  F_c, nilai mesin sebelum penyesuaian panel.
     * @param  float|null  $panelAdjusted  Nilai panel; bila ada, nilai inilah yang dipakai agregasi.
     * @param  list<Flag>  $flags
     */
    public function __construct(
        public string $code,
        public string $aspectCode,
        public bool $isContextual,
        public ?float $perception,
        public ?float $evidence,
        public ?float $validation,
        public ?float $combined,
        public ?float $divergence,
        public ?float $final,
        public ?float $panelAdjusted,
        public array $flags,
    ) {}

    /**
     * @return array{code: string, aspectCode: string, isContextual: bool, perception: float|null, evidence: float|null,
     *     validation: float|null, combined: float|null, divergence: float|null, final: float|null,
     *     panelAdjusted: float|null, flags: list<string>}
     */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'aspectCode' => $this->aspectCode,
            'isContextual' => $this->isContextual,
            'perception' => $this->perception,
            'evidence' => $this->evidence,
            'validation' => $this->validation,
            'combined' => $this->combined,
            'divergence' => $this->divergence,
            'final' => $this->final,
            'panelAdjusted' => $this->panelAdjusted,
            'flags' => Flag::values($this->flags),
        ];
    }
}
