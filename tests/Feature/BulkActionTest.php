<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function bulk_admin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

test('unauthenticated user cannot perform bulk action', function () {
    $this->postJson('/api/v1/users/bulk', ['action' => 'activate', 'ids' => []])
        ->assertUnauthorized();
});

test('non-admin cannot perform bulk action', function () {
    $user = User::factory()->create();
    $user->assignRole('pi');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/users/bulk', ['action' => 'activate', 'ids' => [$user->id]])
        ->assertForbidden();
});

test('validates action and ids fields', function () {
    $admin = bulk_admin();

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/users/bulk', ['action' => 'nuke', 'ids' => 'not-an-array'])
        ->assertUnprocessable();
});

test('bulk activate changes user status to active', function () {
    $admin = bulk_admin();
    $u1 = User::factory()->create(['status' => 'inactive']);
    $u2 = User::factory()->create(['status' => 'inactive']);

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/users/bulk', ['action' => 'activate', 'ids' => [$u1->id, $u2->id]])
        ->assertOk()
        ->assertJsonPath('meta.affected', 2);

    expect($u1->fresh()->status)->toBe('active')
        ->and($u2->fresh()->status)->toBe('active');
});

test('bulk deactivate changes user status to inactive', function () {
    $admin = bulk_admin();
    $u1 = User::factory()->create(['status' => 'active']);
    $u2 = User::factory()->create(['status' => 'active']);

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/users/bulk', ['action' => 'deactivate', 'ids' => [$u1->id, $u2->id]])
        ->assertOk()
        ->assertJsonPath('meta.affected', 2);

    expect($u1->fresh()->status)->toBe('inactive')
        ->and($u2->fresh()->status)->toBe('inactive');
});

test('admin cannot deactivate their own account via bulk action', function () {
    $admin = bulk_admin();

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/users/bulk', ['action' => 'deactivate', 'ids' => [$admin->id]])
        ->assertOk()
        ->assertJsonPath('meta.affected', 0);

    expect($admin->fresh()->status)->toBe('active');
});

test('bulk delete removes users without linked records', function () {
    $admin = bulk_admin();
    $u1 = User::factory()->create();
    $u2 = User::factory()->create();

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/users/bulk', ['action' => 'delete', 'ids' => [$u1->id, $u2->id]])
        ->assertOk()
        ->assertJsonPath('meta.deleted', 2)
        ->assertJsonPath('meta.skipped', 0);

    expect(User::find($u1->id))->toBeNull()
        ->and(User::find($u2->id))->toBeNull();
});
