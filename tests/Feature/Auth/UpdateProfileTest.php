<?php

use App\Models\College;
use App\Models\Department;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function upt_makeCollegeAndDept(): array
{
    $college = College::create(['name' => 'C'.rand(), 'code' => 'UP'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'UPD'.rand(10, 99)]);

    return [$college, $dept];
}

test('a staff user cannot change their own college or department via self-service profile update', function () {
    [$originalCollege, $originalDept] = upt_makeCollegeAndDept();
    [$newCollege, $newDept] = upt_makeCollegeAndDept();

    $user = User::factory()->create(['college_id' => $originalCollege->id, 'department_id' => $originalDept->id]);
    $user->assignRole('staff');

    $response = $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/auth/profile', [
            'college_id' => $newCollege->id,
            'department_id' => $newDept->id,
            'phone' => '+251911000000',
        ]);

    $response->assertOk();
    $fresh = User::find($user->id);
    expect($fresh->college_id)->toBe($originalCollege->id)
        ->and($fresh->department_id)->toBe($originalDept->id)
        ->and($fresh->phone)->toBe('+251911000000');
});

test('a pi user cannot change their own college or department either', function () {
    [$originalCollege, $originalDept] = upt_makeCollegeAndDept();
    [$newCollege, $newDept] = upt_makeCollegeAndDept();

    $user = User::factory()->create(['college_id' => $originalCollege->id, 'department_id' => $originalDept->id]);
    $user->assignRole('pi');

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/auth/profile', [
            'college_id' => $newCollege->id,
            'department_id' => $newDept->id,
        ])
        ->assertOk();

    $fresh = User::find($user->id);
    expect($fresh->college_id)->toBe($originalCollege->id)
        ->and($fresh->department_id)->toBe($originalDept->id);
});

test('an admin CAN change their own college and department via self-service profile update', function () {
    [$originalCollege, $originalDept] = upt_makeCollegeAndDept();
    [$newCollege, $newDept] = upt_makeCollegeAndDept();

    $admin = User::factory()->create(['college_id' => $originalCollege->id, 'department_id' => $originalDept->id]);
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/auth/profile', [
            'college_id' => $newCollege->id,
            'department_id' => $newDept->id,
        ])
        ->assertOk();

    $fresh = User::find($admin->id);
    expect($fresh->college_id)->toBe($newCollege->id)
        ->and($fresh->department_id)->toBe($newDept->id);
});

test('a super_admin CAN change their own college and department via self-service profile update', function () {
    [$originalCollege, $originalDept] = upt_makeCollegeAndDept();
    [$newCollege, $newDept] = upt_makeCollegeAndDept();

    $superAdmin = User::factory()->create(['college_id' => $originalCollege->id, 'department_id' => $originalDept->id]);
    $superAdmin->assignRole('super_admin');

    $this->actingAs($superAdmin, 'sanctum')
        ->putJson('/api/v1/auth/profile', [
            'college_id' => $newCollege->id,
            'department_id' => $newDept->id,
        ])
        ->assertOk();

    $fresh = User::find($superAdmin->id);
    expect($fresh->college_id)->toBe($newCollege->id)
        ->and($fresh->department_id)->toBe($newDept->id);
});
