<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Keluaran ScoringEngine::aggregate(): hasil per aspek dan hasil organisasi. */
final readonly class AggregateResult
{
    /**
     * @param  array<string, AspectResult>  $aspects  Berkunci kode aspek, dalam urutan parameter.
     */
    public function __construct(
        public array $aspects,
        public OrganizationResult $organization,
    ) {}
}
