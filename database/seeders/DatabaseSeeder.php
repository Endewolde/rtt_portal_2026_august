<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            WorkflowStageSeeder::class,
            ThresholdSettingSeeder::class,
            CollegeSeeder::class,
            UserSeeder::class,
            FormTemplateSeeder::class,
            AppSettingsSeeder::class,
            LookupOptionSeeder::class,
        ]);
    }
}
