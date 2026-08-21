<?php

use App\Models\ThresholdSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        ThresholdSetting::updateOrCreate(
            ['key' => 'max_reviewer_active_assignments'],
            [
                'value' => 5.00,
                'description' => 'Max concurrent active reviews (pending/accepted/in_progress) before a reviewer is considered overloaded',
            ],
        );
    }

    public function down(): void
    {
        ThresholdSetting::where('key', 'max_reviewer_active_assignments')->delete();
    }
};
