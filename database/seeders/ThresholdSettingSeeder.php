<?php

namespace Database\Seeders;

use App\Models\ThresholdSetting;
use Illuminate\Database\Seeder;

class ThresholdSettingSeeder extends Seeder
{
    public function run(): void
    {
        // blind_threshold/defence_threshold/combined_threshold are RAW point minimums
        // against each evaluation type's category-weight sum (see EvaluationCriteriaSeeder:
        // blind review categories sum to 80, open defence to 20, combined to 100) — not
        // percentages. Defaults below (60/80=75%, 10/20=50%, 70/100=70%) are chosen to be
        // achievable against those sums.
        $settings = [
            ['key' => 'blind_threshold',      'value' => 60.00, 'description' => 'Minimum raw blind review score (out of the blind review category-weight sum) to pass to open defence'],
            ['key' => 'defence_threshold',    'value' => 10.00, 'description' => 'Minimum raw open defence score (out of the open defence category-weight sum)'],
            ['key' => 'combined_threshold',   'value' => 70.00, 'description' => 'Minimum raw combined score (blind + defence, out of their combined category-weight sum) for acceptance'],
            ['key' => 'similarity_threshold', 'value' => 0.70,  'description' => 'Cosine similarity score above which proposal is flagged'],
            ['key' => 'max_reviewer_active_assignments', 'value' => 5.00, 'description' => 'Max concurrent active reviews (pending/accepted/in_progress) before a reviewer is considered overloaded'],
            ['key' => 'overdue_reminder_interval_days', 'value' => 3.00, 'description' => 'Days between repeat automated reminders sent to a reviewer once their assignment is overdue'],
            ['key' => 'ongoing_midterm_overdue_days', 'value' => 90.00, 'description' => 'Days after funding before a proposal with no midterm evaluation scheduled is flagged overdue on the Ongoing Proposals dashboard'],
        ];

        foreach ($settings as $setting) {
            ThresholdSetting::updateOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
