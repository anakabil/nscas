<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Hasil satu tingkat pada jalur setara (docs/03 bagian 5). */
final readonly class SclStepResult
{
    public function __construct(
        public float $weightedAverage,
        public float $minimum,
        public float $thresholdAverage,
        public float $thresholdMinimum,
        public bool $passed,
    ) {}

    /** @return array{weightedAverage: float, minimum: float, thresholdAverage: float, thresholdMinimum: float, passed: bool} */
    public function toArray(): array
    {
        return [
            'weightedAverage' => $this->weightedAverage,
            'minimum' => $this->minimum,
            'thresholdAverage' => $this->thresholdAverage,
            'thresholdMinimum' => $this->thresholdMinimum,
            'passed' => $this->passed,
        ];
    }
}
