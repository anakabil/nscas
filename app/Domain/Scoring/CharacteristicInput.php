<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Nilai tiga lapisan per karakteristik yang sudah dihitung. Null berarti lapisan kosong. */
final readonly class CharacteristicInput
{
    /**
     * @param  float|null  $perception  P_c
     * @param  float|null  $evidence  E_c
     * @param  float|null  $validation  V_c
     * @param  float|null  $panelAdjusted  PanelAdjustment.adjustedValue bila ada.
     * @param  list<Flag>  $flags  Tanda dari lapisan bukti (PENILAI_TUNGGAL, PERLU_REKONSILIASI).
     */
    public function __construct(
        public string $code,
        public string $aspectCode,
        public bool $isContextual,
        public ?float $perception,
        public ?float $evidence,
        public ?float $validation,
        public ?float $panelAdjusted = null,
        public array $flags = [],
    ) {}
}
