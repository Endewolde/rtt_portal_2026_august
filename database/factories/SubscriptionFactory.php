<?php

namespace Database\Factories;

use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'college_id'           => \App\Models\College::factory(),
            'subscription_plan_id' => \App\Models\SubscriptionPlan::factory(),
            'status'               => 'active',
            'starts_at'            => now(),
            'ends_at'              => now()->addYear(),
            'trial_ends_at'        => null,
            'cancelled_at'         => null,
            'created_by'           => null,
        ];
    }

    public function trial(): static
    {
        return $this->state(['status' => 'trial', 'trial_ends_at' => now()->addDays(14), 'ends_at' => now()->addDays(14)]);
    }

    public function expired(): static
    {
        return $this->state(['status' => 'expired', 'ends_at' => now()->subDay()]);
    }

    public function suspended(): static
    {
        return $this->state(['status' => 'suspended']);
    }
}
