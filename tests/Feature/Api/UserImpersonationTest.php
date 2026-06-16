<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('an admin can impersonate a regular user', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $target = User::factory()->create();
    $target->assignRole('staff');

    $response = $this->actingAs($admin)->postJson("/api/v1/users/{$target->id}/impersonate");

    $response->assertOk();
    expect($response->json('data.token'))->not->toBeNull();
    expect($response->json('data.user.id'))->toBe($target->id);

    $this->assertDatabaseHas('audit_logs', [
        'event' => 'user.impersonation_started',
        'actor_id' => $admin->id,
        'auditable_id' => $target->id,
    ]);
});

test('a plain admin (not super admin) cannot impersonate anyone', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $target = User::factory()->create();
    $target->assignRole('staff');

    $this->actingAs($admin)->postJson("/api/v1/users/{$target->id}/impersonate")->assertStatus(403);
});

test('a non-admin cannot impersonate anyone', function () {
    $user = User::factory()->create();
    $target = User::factory()->create();

    $this->actingAs($user)->postJson("/api/v1/users/{$target->id}/impersonate")->assertStatus(403);
});

test('an admin cannot impersonate another admin or super admin', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $otherAdmin = User::factory()->create();
    $otherAdmin->assignRole('admin');

    $this->actingAs($admin)->postJson("/api/v1/users/{$otherAdmin->id}/impersonate")->assertStatus(422);
});

test('an admin cannot impersonate themselves', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin)->postJson("/api/v1/users/{$admin->id}/impersonate")->assertStatus(422);
});
