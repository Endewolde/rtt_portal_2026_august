<?php

namespace Database\Factories;

use App\Models\College;
use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Department>
 */
class DepartmentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'college_id' => College::factory(),
            'name' => fake()->unique()->words(3, true).' Department',
            'code' => strtoupper(fake()->unique()->lexify('???')),
            'status' => 'active',
        ];
    }
}
