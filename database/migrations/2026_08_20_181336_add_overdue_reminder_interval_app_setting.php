<?php

use App\Models\AppSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        AppSetting::updateOrCreate(
            ['key' => 'overdue_reminder_interval_days'],
            ['value' => '3', 'type' => 'number', 'group' => 'thresholds'],
        );
    }

    public function down(): void
    {
        AppSetting::where('key', 'overdue_reminder_interval_days')->delete();
    }
};
