<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\ActionPlan;

use App\Domain\ActionPlan\ActionPlanRules;
use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class ActionPlanRulesTest extends TestCase
{
    public function test_gap_list_ranks_by_aspect_weight_times_gap_and_puts_contextual_last(): void
    {
        $chars = [
            ['code' => 'K1.1', 'aspectCode' => 'A1', 'isContextual' => false, 'final' => 3.0, 'panelAdjusted' => null],
            ['code' => 'K2.1', 'aspectCode' => 'A2', 'isContextual' => false, 'final' => 2.0, 'panelAdjusted' => null],
            ['code' => 'K3.1', 'aspectCode' => 'A3', 'isContextual' => false, 'final' => 3.5, 'panelAdjusted' => 4.0],
            ['code' => 'KT.1', 'aspectCode' => 'AT', 'isContextual' => true, 'final' => 1.5, 'panelAdjusted' => null],
        ];
        $list = ActionPlanRules::gapList($chars, ['A1' => 0.5, 'A2' => 0.1, 'A3' => 0.4], 4.0);

        $this->assertSame(['K1.1', 'K2.1', 'KT.1'], array_column($list, 'code'));
        $this->assertSame([1, 2, 3], array_column($list, 'rank'));
        $this->assertEqualsWithDelta(0.5, $list[0]['priorityScore'], 1e-12);
        $this->assertEqualsWithDelta(0.2, $list[1]['priorityScore'], 1e-12);
        $this->assertSame(0.0, $list[2]['priorityScore']);
    }

    public function test_due_states_and_weekly_reminders_use_the_wib_calendar(): void
    {
        $now = new DateTimeImmutable('2026-11-19T18:00:00Z'); // 20 November WIB
        $this->assertSame('overdue', ActionPlanRules::dueState('PLANNED', '2026-11-19', $now));
        $this->assertSame('dueSoon', ActionPlanRules::dueState('IN_PROGRESS', '2026-11-27', $now));
        $this->assertSame('onTrack', ActionPlanRules::dueState('IN_PROGRESS', '2026-11-28', $now));
        $this->assertSame('closed', ActionPlanRules::dueState('DONE', '2026-11-01', $now));
        $this->assertTrue(ActionPlanRules::reminderDue('PLANNED', '2026-11-19', null, $now));
        $this->assertFalse(ActionPlanRules::reminderDue('PLANNED', '2026-11-19', $now->modify('-6 days'), $now));
        $this->assertTrue(ActionPlanRules::reminderDue('PLANNED', '2026-11-19', $now->modify('-7 days'), $now));
        $this->assertSame('2026-Q4', ActionPlanRules::quarterOf('2026-11-30'));
        $this->assertSame('2027-Q1', ActionPlanRules::quarterOf('2027-03-31'));
    }

    public function test_publication_and_closing_rules(): void
    {
        $this->assertSame(['K1.1', 'K2.1'], ActionPlanRules::incomplete([
            ['code' => 'K1.1', 'rootCause' => ' ', 'activeActions' => 1],
            ['code' => 'K2.1', 'rootCause' => 'Penyebab', 'activeActions' => 0],
            ['code' => 'K3.1', 'rootCause' => 'Penyebab', 'activeActions' => 2],
        ]));
        $this->assertFalse(ActionPlanRules::monitoringClosed(['VERIFIED', 'DONE'], true));
        $this->assertFalse(ActionPlanRules::monitoringClosed(['VERIFIED', 'CANCELLED'], false));
        $this->assertTrue(ActionPlanRules::monitoringClosed(['VERIFIED', 'CANCELLED'], true));
        $this->assertTrue(ActionPlanRules::planOpen(AssessmentStatus::Monitoring));
        $this->assertFalse(ActionPlanRules::publishOpen(AssessmentStatus::Monitoring));
    }
}
