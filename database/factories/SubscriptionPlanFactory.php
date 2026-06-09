<?php

namespace Database\Factories;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SubscriptionPlan>
 */
class SubscriptionPlanFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'slug'           => fake()->unique()->slug(1),
            'name'           => fake()->words(2, true),
            'description'    => fake()->sentence(),
            'features'       => ['proposals', 'evaluation'],
            'price'          => 0.00,
            'billing_period' => 'annual',
            'is_active'      => true,
        ];
    }

    public function basic(): static
    {
        return $this->state(['slug' => 'basic', 'name' => 'Basic', 'features' => ['proposals', 'evaluation']]);
    }

    public function professional(): static
    {
        return $this->state(['slug' => 'professional', 'name' => 'Professional', 'features' => ['proposals', 'finance', 'evaluation', 'monitoring', 'complaints']]);
    }

    public function enterprise(): static
    {
        return $this->state(['slug' => 'enterprise', 'name' => 'Enterprise', 'features' => ['proposals', 'finance', 'evaluation', 'monitoring', 'reports', 'repository', 'similarity', 'complaints']]);
    }
}
