<?php

use App\Models\AppSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            [
                'key' => 'login_institution_text',
                'value' => 'Haramaya University — Research & Technology Transfer Office',
                'type' => 'string',
                'group' => 'appearance',
                'description' => 'Sub-text shown at the bottom of the login panel.',
            ],
            [
                'key' => 'logo_width',
                'value' => '32',
                'type' => 'number',
                'group' => 'appearance',
                'description' => 'Logo image width in pixels.',
            ],
            [
                'key' => 'logo_height',
                'value' => '32',
                'type' => 'number',
                'group' => 'appearance',
                'description' => 'Logo image height in pixels.',
            ],
        ];

        foreach ($settings as $setting) {
            AppSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting,
            );
        }
    }

    public function down(): void
    {
        AppSetting::whereIn('key', ['login_institution_text', 'logo_width', 'logo_height'])->delete();
    }
};
