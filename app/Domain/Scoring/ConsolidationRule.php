<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/**
 * Batas kemantapan tingkat (docs/03 bagian 4): tingkat L mantap bila
 * min(I_a) >= L - maxAspectBelowLevel dan min(F_c non-kontekstual) >= L - maxCharacteristicBelowLevel.
 */
final readonly class ConsolidationRule
{
    public function __construct(
        public float $maxAspectBelowLevel,
        public float $maxCharacteristicBelowLevel,
    ) {}
}
