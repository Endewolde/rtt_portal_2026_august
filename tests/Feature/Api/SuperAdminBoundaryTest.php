<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function boundarySuperAdmin(): User
{
    $user = User::factory()->create(['password' => Hash::make('correct-password')]);
    $user->assignRole('super_admin');

    return $user;
}

function boundaryAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

// ── createSuperAdmin ────────────────────────────────────────────────────────

test('super admin can create another super admin with correct password', function () {
    $actor = boundarySuperAdmin();

    $response = $this->actingAs($actor, 'sanctum')->postJson('/api/v1/users/create-super-admin', [
        'name' => 'New Super',
        'email' => 'new.super@example.com',
        'password' => 'password123',
        'current_password' => 'correct-password',
    ]);

    $response->assertCreated();

    $created = User::where('email', 'new.super@example.com')->first();
    expect($created)->not->toBeNull()
        ->and($created->hasRole('super_admin'))->toBeTrue();
});

test('creating a super admin fails with the wrong current password', function () {
    $actor = boundarySuperAdmin();

    $this->actingAs($actor, 'sanctum')->postJson('/api/v1/users/create-super-admin', [
        'name' => 'New Super',
        'email' => 'new.super2@example.com',
        'password' => 'password123',
        'current_password' => 'wrong-password',
    ])->assertStatus(422);

    expect(User::where('email', 'new.super2@example.com')->exists())->toBeFalse();
});

test('a plain admin cannot create a super admin', function () {
    $actor = boundaryAdmin();

    $this->actingAs($actor, 'sanctum')->postJson('/api/v1/users/create-super-admin', [
        'name' => 'New Super',
        'email' => 'new.super3@example.com',
        'password' => 'password123',
        'current_password' => 'whatever',
    ])->assertStatus(403);

    expect(User::where('email', 'new.super3@example.com')->exists())->toBeFalse();
});

// ── store() ─────────────────────────────────────────────────────────────────

test('store rejects super_admin role even from a super admin actor', function () {
    $actor = boundarySuperAdmin();

    $this->actingAs($actor, 'sanctum')->postJson('/api/v1/users', [
        'name' => 'Sneaky',
        'email' => 'sneaky@example.com',
        'password' => 'password123',
        'role' => 'super_admin',
    ])->assertStatus(403);

    expect(User::where('email', 'sneaky@example.com')->exists())->toBeFalse();
});

// ── update() ─────────────────────────────────────────────────────────────────

test('update rejects promoting a user to super_admin', function () {
    $actor = boundaryAdmin();
    $target = User::factory()->create();
    $target->assignRole('staff');

    $this->actingAs($actor, 'sanctum')->putJson("/api/v1/users/{$target->id}", [
        'role' => 'super_admin',
    ])->assertStatus(403);

    expect($target->fresh()->hasRole('super_admin'))->toBeFalse();
});

test('update rejects demoting an existing super admin', function () {
    $actor = boundaryAdmin();
    $target = boundarySuperAdmin();

    $this->actingAs($actor, 'sanctum')->putJson("/api/v1/users/{$target->id}", [
        'role' => 'staff',
    ])->assertStatus(403);

    expect($target->fresh()->hasRole('super_admin'))->toBeTrue();
});

test('update still allows editing other fields on a super admin without changing role', function () {
    $actor = boundaryAdmin();
    $target = boundarySuperAdmin();

    $this->actingAs($actor, 'sanctum')->putJson("/api/v1/users/{$target->id}", [
        'phone' => '+251911223344',
    ])->assertOk();

    expect($target->fresh()->phone)->toBe('+251911223344')
        ->and($target->fresh()->hasRole('super_admin'))->toBeTrue();
});

// ── updateRole() ─────────────────────────────────────────────────────────────

test('updateRole rejects granting super_admin', function () {
    $actor = boundaryAdmin();
    $target = User::factory()->create();
    $target->assignRole('staff');

    $this->actingAs($actor, 'sanctum')->putJson("/api/v1/users/{$target->id}/role", [
        'role' => 'super_admin',
    ])->assertStatus(403);

    expect($target->fresh()->hasRole('super_admin'))->toBeFalse();
});

test('updateRole rejects changing an existing super admin away from that role', function () {
    $actor = boundaryAdmin();
    $target = boundarySuperAdmin();

    $this->actingAs($actor, 'sanctum')->putJson("/api/v1/users/{$target->id}/role", [
        'role' => 'staff',
    ])->assertStatus(403);

    expect($target->fresh()->hasRole('super_admin'))->toBeTrue();
});

// ── bulkAction() assign_role ──────────────────────────────────────────────────

test('bulk assign_role rejects bulk-granting super_admin', function () {
    $actor = boundaryAdmin();
    $target = User::factory()->create();
    $target->assignRole('staff');

    $this->actingAs($actor, 'sanctum')->postJson('/api/v1/users/bulk', [
        'action' => 'assign_role',
        'ids' => [$target->id],
        'role' => 'super_admin',
    ])->assertStatus(403);

    expect($target->fresh()->hasRole('super_admin'))->toBeFalse();
});

test('bulk assign_role skips existing super admins in the target set', function () {
    $actor = boundaryAdmin();
    $superTarget = boundarySuperAdmin();
    $staffTarget = User::factory()->create();
    $staffTarget->assignRole('staff');

    $response = $this->actingAs($actor, 'sanctum')->postJson('/api/v1/users/bulk', [
        'action' => 'assign_role',
        'ids' => [$superTarget->id, $staffTarget->id],
        'role' => 'reviewer',
    ]);

    $response->assertOk()->assertJsonPath('meta.affected', 1);

    expect($superTarget->fresh()->hasRole('super_admin'))->toBeTrue()
        ->and($staffTarget->fresh()->hasRole('reviewer'))->toBeTrue();
});
