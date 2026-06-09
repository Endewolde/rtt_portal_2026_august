<?php

namespace Database\Factories;

use App\Models\College;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<College>
 */
class CollegeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name'       => fake()->unique()->company() . ' College',
            'code'       => strtoupper(fake()->unique()->lexify('???')),
            'dean_name'  => fake()->name(),
            'dean_email' => fake()->unique()->safeEmail(),
            'status'     => 'active',
        ];
    }
}
