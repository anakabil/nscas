<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Organization> */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        return ['name' => 'PT '.fake()->unique()->company(), 'is_operator' => false];
    }

    public function operator(): static
    {
        return $this->state(['name' => 'Nusa Safety', 'is_operator' => true]);
    }
}
