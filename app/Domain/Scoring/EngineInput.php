<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Masukan ScoringEngine::runEngine(): nilai lapisan per karakteristik yang sudah jadi. */
final readonly class EngineInput
{
    /**
     * @param  list<CharacteristicInput>  $characteristics
     * @param  array<string, array<int, int|float>>|null  $sclFulfillment  Persentase pemenuhan per kode aspek per tingkat
     *                                                                     (2 sampai 5), rentang 0 sampai 1. Null bila jalur setara tidak dihitung.
     */
    public function __construct(
        public array $characteristics,
        public float $targetLevel,
        public ?array $sclFulfillment = null,
    ) {}
}
