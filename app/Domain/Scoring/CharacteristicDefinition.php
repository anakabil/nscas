<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Identitas satu karakteristik: kode, aspek induk, dan apakah kontekstual (aspek KT). */
final readonly class CharacteristicDefinition
{
    public function __construct(
        public string $code,
        public string $aspectCode,
        public bool $isContextual,
    ) {}
}
