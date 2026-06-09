<?php

namespace Database\Seeders;

use App\Models\ThresholdSetting;
use Illuminate\Database\Seeder;

class ThresholdSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['key' => 'blind_threshold',      'value' => 60.00,  'description' => 'Minimum blind review score percentage to pass to open defence'],
            ['key' => 'defence_threshold',    'value' => 60.00,  'description' => 'Minimum open defence score percentage'],
            ['key' => 'combined_threshold',   'value' => 120.00, 'description' => 'Minimum combined score (blind + defence) for acceptance'],
            ['key' => 'similarity_threshold', 'value' => 0.70,   'description' => 'Cosine similarity score above which proposal is flagged'],
        ];

        foreach ($settings as $setting) {
            ThresholdSetting::updateOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
