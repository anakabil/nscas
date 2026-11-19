<?php

namespace Database\Factories;

use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Assessment> */
class AssessmentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'name' => 'Asesmen Budaya K3 '.fake()->year(),
            'period_start' => '2026-11-01',
            'period_end' => '2027-01-31',
            'target_level' => 4,
            'status' => AssessmentStatus::Draft,
        ];
    }

    public function status(AssessmentStatus $status): static
    {
        return $this->state(['status' => $status]);
    }
}
