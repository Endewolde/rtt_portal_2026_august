<?php

use App\Models\AppSetting;
use App\Models\ThresholdSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        AppSetting::updateOrCreate(
            ['key' => 'ongoing_midterm_overdue_days'],
            ['value' => '90', 'type' => 'number', 'group' => 'thresholds'],
        );

        ThresholdSetting::updateOrCreate(
            ['key' => 'ongoing_midterm_overdue_days'],
            [
                'value' => 90.00,
                'description' => 'Days after funding before a proposal with no midterm evaluation scheduled is flagged overdue on the Ongoing Proposals dashboard',
            ],
        );
    }

    public function down(): void
    {
        AppSetting::where('key', 'ongoing_midterm_overdue_days')->delete();
        ThresholdSetting::where('key', 'ongoing_midterm_overdue_days')->delete();
    }
};
