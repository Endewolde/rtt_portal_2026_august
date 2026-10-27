<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('a user\'s latest role comes first, with its current label', function () {
    $user = User::factory()->create();
    $user->assignRole('reviewer');
    $user->assignRole('staff');
    // The assignment time comes from the database clock; date them apart explicitly.
    DB::table('model_has_roles')->where('model_id', $user->id)->where('role_id', Role::findByName('staff')->id)->update(['assigned_at' => now()->subHour()]);

    $this->actingAs($user->fresh(), 'sanctum')->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.user.roles.0', 'reviewer')
        ->assertJsonPath('data.user.role_labels.staff', 'Researcher (Staff)');
});

test('adding a role on the Users page makes it the latest, keeping the others', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $user = User::factory()->create();
    $user->assignRole('staff');
    DB::table('model_has_roles')->where('model_id', $user->id)->update(['assigned_at' => now()->subHour()]);

    $this->actingAs($admin, 'sanctum')->putJson("/api/v1/users/{$user->id}/roles", ['roles' => ['staff', 'reviewer']])->assertOk();

    expect($user->fresh()->getRoleNames()->all())->toBe(['reviewer', 'staff']);
});
