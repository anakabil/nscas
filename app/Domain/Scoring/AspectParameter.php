<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Satu aspek pada parameter asesmen. */
final readonly class AspectParameter
{
    /**
     * @param  float|null  $maxPointsStep5  Poin maksimum tingkat 5; bobot aspek = poin ini dibagi jumlah poin seluruh aspek (18.000).
     * @param  bool  $excludedFromLevel  Aspek kontekstual (KT) dihitung tetapi tidak masuk indeks organisasi.
     */
    public function __construct(
        public string $code,
        public ?float $maxPointsStep5,
        public bool $excludedFromLevel = false,
    ) {}

    /** @return array{code: string, maxPointsStep5: float|null, excludedFromLevel: bool} */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'maxPointsStep5' => $this->maxPointsStep5,
            'excludedFromLevel' => $this->excludedFromLevel,
        ];
    }
}
