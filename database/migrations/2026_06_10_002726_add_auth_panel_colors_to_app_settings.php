<?php

use App\Models\AppSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            [
                'key' => 'auth_panel_from_color',
                'value' => '#047857',
                'type' => 'color',
                'group' => 'appearance',
                'description' => 'Login/Register panel gradient start color.',
            ],
            [
                'key' => 'auth_panel_to_color',
                'value' => '#0e7490',
                'type' => 'color',
                'group' => 'appearance',
                'description' => 'Login/Register panel gradient end color.',
            ],
        ];

        foreach ($settings as $setting) {
            AppSetting::updateOrCreate(['key' => $setting['key']], $setting);
        }
    }

    public function down(): void
    {
        AppSetting::whereIn('key', ['auth_panel_from_color', 'auth_panel_to_color'])->delete();
    }
};
