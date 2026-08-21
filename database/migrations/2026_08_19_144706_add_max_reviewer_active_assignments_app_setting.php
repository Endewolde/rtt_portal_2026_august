<?php

use App\Models\AppSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        AppSetting::updateOrCreate(
            ['key' => 'max_reviewer_active_assignments'],
            ['value' => '5', 'type' => 'number', 'group' => 'thresholds'],
        );
    }

    public function down(): void
    {
        AppSetting::where('key', 'max_reviewer_active_assignments')->delete();
    }
};
