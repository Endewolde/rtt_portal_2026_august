<?php

use App\Models\College;
use App\Models\Department;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ── User delete ───────────────────────────────────────────────────────────────

test('super admin can permanently delete a user with no linked data', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $target = User::factory()->create();

    $this->actingAs($admin)
        ->deleteJson("/api/v1/users/{$target->id}")
        ->assertStatus(200);

    $this->assertDatabaseMissing('users', ['id' => $target->id]);
    $this->assertDatabaseMissing('notification_preferences', ['user_id' => $target->id]);
});

test('delete is blocked when user has linked activity logs or forms', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $target = User::factory()->create();

    DB::table('form_templates')->insert([
        'id' => Str::uuid(),
        'name' => 'Test Template',
        'is_active' => true,
        'created_by' => $target->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->actingAs($admin)
        ->deleteJson("/api/v1/users/{$target->id}")
        ->assertStatus(422);

    expect($response->json('message'))->toContain('activity logs or signed forms');

    $this->assertDatabaseHas('users', ['id' => $target->id]);
});

test('non-super-admin cannot delete a user', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');

    $target = User::factory()->create();

    $this->actingAs($user)
        ->deleteJson("/api/v1/users/{$target->id}")
        ->assertStatus(403);

    $this->assertDatabaseHas('users', ['id' => $target->id]);
});

test('super admin cannot delete their own account', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin)
        ->deleteJson("/api/v1/users/{$admin->id}")
        ->assertStatus(422);
});

// ── College delete ────────────────────────────────────────────────────────────

test('super admin can delete a college with no departments', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $college = College::factory()->create();

    $this->actingAs($admin)
        ->deleteJson("/api/v1/colleges/{$college->id}")
        ->assertStatus(200);

    $this->assertDatabaseMissing('colleges', ['id' => $college->id]);
});

test('cannot delete a college that has departments', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $college = College::factory()->create();
    Department::factory()->create(['college_id' => $college->id]);

    $this->actingAs($admin)
        ->deleteJson("/api/v1/colleges/{$college->id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Cannot delete a college that has departments. Remove all departments first.');

    $this->assertDatabaseHas('colleges', ['id' => $college->id]);
});

test('non-super-admin cannot delete a college', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');

    $college = College::factory()->create();

    $this->actingAs($user)
        ->deleteJson("/api/v1/colleges/{$college->id}")
        ->assertStatus(403);
});

// ── Department delete ─────────────────────────────────────────────────────────

test('super admin can delete a department', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);

    $this->actingAs($admin)
        ->deleteJson("/api/v1/departments/{$dept->id}")
        ->assertStatus(200);

    $this->assertDatabaseMissing('departments', ['id' => $dept->id]);
});

test('non-super-admin cannot delete a department', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');

    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/departments/{$dept->id}")
        ->assertStatus(403);

    $this->assertDatabaseHas('departments', ['id' => $dept->id]);
});
