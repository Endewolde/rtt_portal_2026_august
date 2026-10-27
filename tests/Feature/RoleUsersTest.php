<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
});

test('the roles page can list who holds a role, with names and emails', function () {
    $reviewers = User::factory()->count(3)->create();
    $reviewers->each->assignRole('reviewer');
    $role = Role::findByName('reviewer', 'web');

    $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/roles/{$role->id}/users")
        ->assertOk()
        ->assertJsonPath('meta.total', 3)
        ->assertJsonCount(3, 'data')
        ->assertJsonFragment(['name' => $reviewers[0]->name, 'email' => $reviewers[0]->email]);
});

test('only role managers can see who holds a role', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $role = Role::findByName('reviewer', 'web');

    $this->actingAs($staff, 'sanctum')->getJson("/api/v1/roles/{$role->id}/users")->assertForbidden();
});

test('a role counts only users who still exist', function () {
    $role = Role::findByName('reviewer', 'web');
    User::factory()->count(2)->create()->each->assignRole('reviewer');
    // A link left behind by a user removed outside the app.
    DB::table('model_has_roles')->insert(['role_id' => $role->id, 'model_type' => User::class, 'model_id' => (string) Str::uuid()]);
    $softDeleted = User::factory()->create();
    $softDeleted->assignRole('reviewer');
    $softDeleted->delete();

    $count = collect($this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/roles')->assertOk()->json('data'))
        ->firstWhere('name', 'reviewer')['users_count'];

    expect($count)->toBe(2);
});

test('removing a user for good removes their role links', function () {
    $user = User::factory()->create();
    $user->assignRole('reviewer');
    $user->forceDelete();

    expect(DB::table('model_has_roles')->where('model_id', $user->id)->exists())->toBeFalse();
});

test('hovering a user shows their details to those who manage users', function () {
    $user = User::factory()->create(['phone' => '0911000000']);
    $user->assignRole('reviewer');

    $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/users/{$user->id}/card")
        ->assertOk()
        ->assertJsonPath('data.email', $user->email)
        ->assertJsonPath('data.phone', '0911000000')
        ->assertJsonPath('data.roles.0', 'Reviewer')
        ->assertJsonPath('data.activity.proposals', 0);

    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff, 'sanctum')->getJson("/api/v1/users/{$user->id}/card")->assertForbidden();
});
