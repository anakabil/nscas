<?php

declare(strict_types=1);

namespace Tests\Unit\Domain;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\Stage;
use App\Domain\Workflow\StageState;
use App\Domain\Workflow\Workflow;
use PHPUnit\Framework\TestCase;

class WorkflowTest extends TestCase
{
    public function test_every_open_status_belongs_to_exactly_one_stage(): void
    {
        foreach (AssessmentStatus::cases() as $status) {
            $owners = array_filter(Stage::cases(), fn (Stage $stage) => in_array($status, $stage->statuses(), true));
            $this->assertCount($status->isClosed() ? 0 : 1, $owners, $status->value);
        }
    }

    public function test_stages_are_numbered_one_to_six_in_method_order(): void
    {
        $this->assertSame([1, 2, 3, 4, 5, 6], array_map(fn (Stage $s) => $s->number(), Stage::cases()));
        $this->assertSame(Stage::Validation, Stage::of(AssessmentStatus::Validation));
        $this->assertSame(Stage::Rating, Stage::of(AssessmentStatus::PanelReview));
        $this->assertNull(Stage::of(AssessmentStatus::Archived));
    }

    public function test_stage_state_follows_the_assessment_status(): void
    {
        $status = AssessmentStatus::Validation;
        $this->assertSame(StageState::Done, Stage::DataCollection->stateFor($status));
        $this->assertSame(StageState::Current, Stage::Validation->stateFor($status));
        $this->assertSame(StageState::Upcoming, Stage::Rating->stateFor($status));
        // Asesmen yang sudah ditutup: semua tahap selesai.
        $this->assertSame(StageState::Done, Stage::Monitoring->stateFor(AssessmentStatus::Archived));
    }

    public function test_cycle_moves_forward_one_step_at_a_time(): void
    {
        $cases = AssessmentStatus::cases();
        for ($i = 0; $i < count($cases) - 1; $i++) {
            $transition = Workflow::next($cases[$i]);
            $this->assertNotNull($transition, $cases[$i]->value);
            $this->assertSame($cases[$i + 1], $transition->to);
            $this->assertNotEmpty($transition->conditions);
        }
        $this->assertNull(Workflow::next(AssessmentStatus::Purged));
        $this->assertFalse(Workflow::canTransition(AssessmentStatus::Draft, AssessmentStatus::Locked));
        $this->assertFalse(Workflow::canTransition(AssessmentStatus::Scoring, AssessmentStatus::Validation));
    }

    public function test_validation_follows_data_collection_and_precedes_scoring(): void
    {
        $this->assertTrue(Workflow::canTransition(AssessmentStatus::DataCollection, AssessmentStatus::Validation));
        $this->assertTrue(Workflow::canTransition(AssessmentStatus::Validation, AssessmentStatus::Scoring));
        $gate = Workflow::next(AssessmentStatus::DataCollection);
        $this->assertContains('data_quality_reviewed', $gate->conditions);
        $this->assertContains('participation_reviewed', $gate->conditions);
    }

    public function test_only_super_admin_purges_and_parameters_lock_from_locked_onwards(): void
    {
        foreach (Workflow::transitions() as $transition) {
            $expected = $transition->to === AssessmentStatus::Purged ? Role::SuperAdmin : Role::LeadAssessor;
            $this->assertSame($expected, $transition->actor);
        }
        $this->assertFalse(AssessmentStatus::Configured->parametersLocked());
        $this->assertTrue(AssessmentStatus::Locked->parametersLocked());
        $this->assertFalse(AssessmentStatus::PanelReview->resultsFinal());
        $this->assertTrue(AssessmentStatus::ActionPlanning->resultsFinal());
    }
}
