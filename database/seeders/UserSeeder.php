<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('Password@123');

        // Strict lookups — throw early rather than silently inserting nulls
        $college = function (string $code): string {
            $c = College::where('code', $code)->first();
            if (! $c) {
                throw new \RuntimeException("College '{$code}' not found. Run CollegeSeeder first.");
            }

            return $c->id;
        };

        $dept = function (string $code, string $collegeCode): string {
            $collegeId = College::where('code', $collegeCode)->value('id');
            $d = Department::where('code', $code)->where('college_id', $collegeId)->first();
            if (! $d) {
                throw new \RuntimeException("Department '{$code}' in college '{$collegeCode}' not found.");
            }

            return $d->id;
        };

        $ensure = function (array $data) use ($password): void {
            // updateOrCreate so re-running the seeder fixes any missing fields
            $user = User::updateOrCreate(
                ['email' => $data['email']],
                array_merge([
                    'name' => $data['name'],
                    'password' => $password,
                    'status' => 'active',
                    'email_verified_at' => now(),
                ], $data['attrs'] ?? [])
            );

            $user->syncRoles([$data['role']]);

            NotificationPreference::firstOrCreate(
                ['user_id' => $user->id],
                ['email_enabled' => true, 'telegram_enabled' => true, 'inapp_enabled' => true]
            );
        };

        // ── Super Admin ───────────────────────────────────────────────────────
        $ensure(['name' => 'Super Admin',        'email' => 'superadmin@rtt.edu', 'role' => 'super_admin', 'attrs' => ['gender' => 'male']]);

        // ── Central Office ────────────────────────────────────────────────────
        $ensure(['name' => 'Central Officer One', 'email' => 'central1@rtt.edu',  'role' => 'central_officer', 'attrs' => ['gender' => 'male']]);
        $ensure(['name' => 'Central Officer Two', 'email' => 'central2@rtt.edu',  'role' => 'central_officer', 'attrs' => ['gender' => 'female']]);

        // ── College Admins ────────────────────────────────────────────────────
        foreach ([
            ['name' => 'CNCS Admin', 'email' => 'admin.cncs@rtt.edu', 'code' => 'CNCS', 'gender' => 'male'],
            ['name' => 'CBE Admin',  'email' => 'admin.cbe@rtt.edu',  'code' => 'CBE',  'gender' => 'male'],
            ['name' => 'CSSH Admin', 'email' => 'admin.cssh@rtt.edu', 'code' => 'CSSH', 'gender' => 'female'],
        ] as $ca) {
            $ensure([
                'name' => $ca['name'],
                'email' => $ca['email'],
                'role' => 'college_admin',
                'attrs' => ['college_id' => $college($ca['code']), 'gender' => $ca['gender']],
            ]);
        }

        // ── Reviewers ─────────────────────────────────────────────────────────
        $reviewerGenders = ['male', 'female', 'male', 'female', 'male'];
        foreach (range(1, 5) as $i) {
            $ensure(['name' => "Reviewer {$i}", 'email' => "reviewer{$i}@rtt.edu", 'role' => 'reviewer', 'attrs' => ['gender' => $reviewerGenders[$i - 1]]]);
        }

        // ── PIs — must have both college and department ────────────────────────
        foreach ([
            ['name' => 'PI One',   'email' => 'pi1@rtt.edu', 'college' => 'CNCS', 'dept' => 'CS',   'gender' => 'male'],
            ['name' => 'PI Two',   'email' => 'pi2@rtt.edu', 'college' => 'CNCS', 'dept' => 'MATH', 'gender' => 'male'],
            ['name' => 'PI Three', 'email' => 'pi3@rtt.edu', 'college' => 'CBE',  'dept' => 'ACCT', 'gender' => 'female'],
            ['name' => 'PI Four',  'email' => 'pi4@rtt.edu', 'college' => 'CBE',  'dept' => 'MGMT', 'gender' => 'male'],
            ['name' => 'PI Five',  'email' => 'pi5@rtt.edu', 'college' => 'CSSH', 'dept' => 'HIST', 'gender' => 'female'],
        ] as $pi) {
            $ensure([
                'name' => $pi['name'],
                'email' => $pi['email'],
                'role' => 'pi',
                'attrs' => [
                    'college_id' => $college($pi['college']),
                    'department_id' => $dept($pi['dept'], $pi['college']),
                    'gender' => $pi['gender'],
                ],
            ]);
        }

        // ── Finance ───────────────────────────────────────────────────────────
        $ensure(['name' => 'Finance Officer', 'email' => 'finance@rtt.edu', 'role' => 'finance', 'attrs' => ['gender' => 'female']]);

        // ── Department Head ───────────────────────────────────────────────────
        $ensure([
            'name' => 'Dept Head CS',
            'email' => 'depthead@rtt.edu',
            'role' => 'department_head',
            'attrs' => [
                'college_id' => $college('CNCS'),
                'department_id' => $dept('CS', 'CNCS'),
                'gender' => 'male',
            ],
        ]);
    }
}
