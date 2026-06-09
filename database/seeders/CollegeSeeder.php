<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Department;
use Illuminate\Database\Seeder;

class CollegeSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            [
                'college' => ['name' => 'College of Natural and Computational Sciences', 'code' => 'CNCS', 'dean_name' => 'Dr. Abebe Kebede', 'status' => 'active'],
                'departments' => [
                    ['name' => 'Computer Science', 'code' => 'CS'],
                    ['name' => 'Mathematics', 'code' => 'MATH'],
                    ['name' => 'Physics', 'code' => 'PHYS'],
                ],
            ],
            [
                'college' => ['name' => 'College of Business and Economics', 'code' => 'CBE', 'dean_name' => 'Dr. Tigist Alemu', 'status' => 'active'],
                'departments' => [
                    ['name' => 'Accounting', 'code' => 'ACCT'],
                    ['name' => 'Management', 'code' => 'MGMT'],
                    ['name' => 'Economics', 'code' => 'ECON'],
                ],
            ],
            [
                'college' => ['name' => 'College of Social Sciences and Humanities', 'code' => 'CSSH', 'dean_name' => 'Dr. Yonas Tesfaye', 'status' => 'active'],
                'departments' => [
                    ['name' => 'History', 'code' => 'HIST'],
                    ['name' => 'Geography', 'code' => 'GEOG'],
                    ['name' => 'Sociology', 'code' => 'SOC'],
                ],
            ],
        ];

        foreach ($data as $entry) {
            $college = College::updateOrCreate(
                ['code' => $entry['college']['code']],
                $entry['college']
            );

            foreach ($entry['departments'] as $dept) {
                Department::updateOrCreate(
                    ['code' => $dept['code'], 'college_id' => $college->id],
                    array_merge($dept, ['college_id' => $college->id, 'status' => 'active'])
                );
            }
        }
    }
}
