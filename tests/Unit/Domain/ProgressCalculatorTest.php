<?php

declare(strict_types=1);

namespace Tests\Unit\Domain;

use App\Domain\Progress\ProgressCalculator;
use App\Domain\Setup\ConditionResult;
use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class ProgressCalculatorTest extends TestCase
{
    private function day(string $date): DateTimeImmutable
    {
        return new DateTimeImmutable($date);
    }

    public function test_schedule_reports_phase_elapsed_share_and_days_remaining(): void
    {
        $start = $this->day('2026-11-01');
        $end = $this->day('2026-11-30');

        $before = ProgressCalculator::schedule($start, $end, $this->day('2026-10-20'));
        $this->assertSame(['notStarted', 0.0, 41, 30], [$before->phase, $before->elapsed, $before->daysRemaining, $before->totalDays]);

        $middle = ProgressCalculator::schedule($start, $end, $this->day('2026-11-15 16:30'));
        $this->assertSame('running', $middle->phase);
        $this->assertEqualsWithDelta(0.5, $middle->elapsed, 1e-9);
        $this->assertSame(15, $middle->daysRemaining);

        $after = ProgressCalculator::schedule($start, $end, $this->day('2026-12-02'));
        $this->assertSame(['ended', 1.0, -2], [$after->phase, $after->elapsed, $after->daysRemaining]);
    }

    public function test_readiness_separates_met_checkable_and_total(): void
    {
        $readiness = ProgressCalculator::readiness([
            new ConditionResult('a', true, null),
            new ConditionResult('b', false, null),
            new ConditionResult('c', null, null),
        ]);

        $this->assertSame(['met' => 1, 'checkable' => 2, 'total' => 3], $readiness);
    }

    public function test_attention_flags(): void
    {
        $schedule = fn (string $today) => ProgressCalculator::schedule($this->day('2026-11-01'), $this->day('2026-11-30'), $this->day($today));
        $none = ['met' => 0, 'checkable' => 0, 'total' => 0];
        $ready = ['met' => 5, 'checkable' => 5, 'total' => 5];

        $this->assertSame(['planningLate'], ProgressCalculator::attention(AssessmentStatus::Draft, $schedule('2026-11-03'), $none));
        $this->assertSame([], ProgressCalculator::attention(AssessmentStatus::Draft, $schedule('2026-10-03'), $none));
        $this->assertSame(['endingSoon'], ProgressCalculator::attention(AssessmentStatus::DataCollection, $schedule('2026-11-20'), $none));
        $this->assertSame(['periodEnded', 'readyToAdvance'], ProgressCalculator::attention(AssessmentStatus::Scoring, $schedule('2026-12-05'), $ready));
        $this->assertSame([], ProgressCalculator::attention(AssessmentStatus::Monitoring, $schedule('2026-12-05'), $none));
        $this->assertSame([], ProgressCalculator::attention(AssessmentStatus::Archived, $schedule('2026-12-05'), $ready));
    }
}
