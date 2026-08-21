<?php

use App\Models\ThresholdSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        ThresholdSetting::updateOrCreate(
            ['key' => 'overdue_reminder_interval_days'],
            [
                'value' => 3.00,
                'description' => 'Days between repeat automated reminders sent to a reviewer once their assignment is overdue',
            ],
        );
    }

    public function down(): void
    {
        ThresholdSetting::where('key', 'overdue_reminder_interval_days')->delete();
    }
};
