<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class ProductionSeeder extends Seeder
{
    /**
     * Run ONLY seeders safe for production.
     * Never seeds fake users or test proposals.
     */
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            WorkflowStageSeeder::class,
            ThresholdSettingSeeder::class,
            FormTemplateSeeder::class,
            EvaluationCriteriaSeeder::class,
        ]);

        // Only seed colleges if the table is empty — safe to run on existing prod data
        if (\App\Models\College::count() === 0) {
            $this->call(CollegeSeeder::class);
        }
    }
}
