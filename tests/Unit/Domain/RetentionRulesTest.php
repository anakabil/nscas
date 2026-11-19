<?php

declare(strict_types=1);

namespace Tests\Unit\Domain;

use App\Domain\Retention\RetentionRules;
use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class RetentionRulesTest extends TestCase
{
    public function test_retention_counts_from_the_signed_report_or_the_finalized_results(): void
    {
        $report = new DateTimeImmutable('2026-01-10T00:00:00Z');
        $results = new DateTimeImmutable('2025-12-01T00:00:00Z');
        $this->assertEquals($report, RetentionRules::baseline($report, $results));
        $this->assertEquals($results, RetentionRules::baseline(null, $results));
        $this->assertNull(RetentionRules::baseline(null, null));
        $this->assertEquals(new DateTimeImmutable('2029-01-10T00:00:00Z'), RetentionRules::dueAt($report, 36));
    }

    public function test_destruction_needs_an_archived_assessment_past_its_retention(): void
    {
        $due = new DateTimeImmutable('2029-01-10T00:00:00Z');
        $this->assertFalse(RetentionRules::destructionAllowed(AssessmentStatus::Archived, $due, new DateTimeImmutable('2029-01-09T23:59:59Z')));
        $this->assertTrue(RetentionRules::destructionAllowed(AssessmentStatus::Archived, $due, new DateTimeImmutable('2029-01-10T00:00:00Z')));
        $this->assertFalse(RetentionRules::destructionAllowed(AssessmentStatus::Monitoring, $due, new DateTimeImmutable('2030-01-01T00:00:00Z')));
        $this->assertFalse(RetentionRules::destructionAllowed(AssessmentStatus::Archived, null, new DateTimeImmutable('2030-01-01T00:00:00Z')));
    }
}
