<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function ualt_admin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

test('impersonation logs the target\'s identity, not a redundant copy of the actor', function () {
    $admin = ualt_admin();
    $target = User::factory()->create(['name' => 'Target Person', 'email' => 'target@example.com']);
    $target->assignRole('staff');

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/users/{$target->id}/impersonate")
        ->assertOk();

    $log = AuditLog::where('event', 'user.impersonation_started')->where('actor_id', $admin->id)->firstOrFail();

    expect($log->auditable_id)->toBe($target->id)
        ->and($log->new_values['target_name'])->toBe('Target Person')
        ->and($log->new_values['target_email'])->toBe('target@example.com')
        ->and($log->new_values)->not->toHaveKey('impersonated_by');
});

test('changing a user\'s role logs the target\'s identity', function () {
    $admin = ualt_admin();
    $target = User::factory()->create(['name' => 'Role Target']);
    $target->assignRole('staff');

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/users/{$target->id}/role", ['role' => 'reviewer'])
        ->assertOk();

    $log = AuditLog::where('event', 'user.role_changed')->where('auditable_id', $target->id)->firstOrFail();

    expect($log->new_values['target_name'])->toBe('Role Target')
        ->and($log->new_values['role'])->toBe('reviewer');
});

test('changing a user\'s status logs the target\'s identity', function () {
    $admin = ualt_admin();
    $target = User::factory()->create(['name' => 'Status Target', 'status' => 'active']);
    $target->assignRole('staff');

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/users/{$target->id}/status", ['status' => 'suspended'])
        ->assertOk();

    $log = AuditLog::where('event', 'user.status_changed')->where('auditable_id', $target->id)->firstOrFail();

    expect($log->new_values['target_name'])->toBe('Status Target')
        ->and($log->new_values['status'])->toBe('suspended');
});

test('creating a user logs the new account\'s name', function () {
    $admin = ualt_admin();

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/users', [
            'name' => 'Brand New', 'email' => 'brandnew@example.com', 'password' => 'password123',
            'role' => 'staff',
        ])
        ->assertCreated();

    $log = AuditLog::where('event', 'user.created')->latest('created_at')->firstOrFail();

    expect($log->new_values['target_name'])->toBe('Brand New')
        ->and($log->new_values['target_email'])->toBe('brandnew@example.com');
});

test('updating a user profile logs an entry with the target\'s identity and the changed fields', function () {
    $admin = ualt_admin();
    $target = User::factory()->create(['name' => 'Old Name', 'phone' => '111']);
    $target->assignRole('staff');

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/users/{$target->id}", ['name' => 'New Name', 'phone' => '222'])
        ->assertOk();

    $log = AuditLog::where('event', 'user.updated')->where('auditable_id', $target->id)->firstOrFail();

    expect($log->new_values['target_name'])->toBe('New Name')
        ->and($log->new_values['name'])->toBe('New Name')
        ->and($log->old_values['name'])->toBe('Old Name')
        ->and($log->new_values['phone'])->toBe('222');
});

test('a no-op user update (nothing actually changed) does not create an audit log entry', function () {
    $admin = ualt_admin();
    $target = User::factory()->create(['name' => 'Same Name']);
    $target->assignRole('staff');

    $before = AuditLog::where('event', 'user.updated')->count();

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/users/{$target->id}", ['name' => 'Same Name'])
        ->assertOk();

    expect(AuditLog::where('event', 'user.updated')->count())->toBe($before);
});

test('deleting a user logs the deleted account\'s identity, captured before deletion', function () {
    $admin = ualt_admin();
    $target = User::factory()->create(['name' => 'Doomed User', 'email' => 'doomed@example.com']);
    $target->assignRole('staff');
    $targetId = $target->id;

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/users/{$targetId}")
        ->assertOk();

    $log = AuditLog::where('event', 'user.deleted')->where('auditable_id', $targetId)->firstOrFail();

    expect($log->old_values['target_name'])->toBe('Doomed User')
        ->and($log->old_values['target_email'])->toBe('doomed@example.com')
        ->and(User::find($targetId))->toBeNull();
});

test('bulk-syncing a user\'s full role set logs the target\'s identity', function () {
    $admin = ualt_admin();
    $target = User::factory()->create(['name' => 'Multi Role Target']);
    $target->assignRole('staff');

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/users/{$target->id}/roles", ['roles' => ['reviewer']])
        ->assertOk();

    $log = AuditLog::where('event', 'user.roles_changed')->where('auditable_id', $target->id)->firstOrFail();

    expect($log->new_values['target_name'])->toBe('Multi Role Target')
        ->and($log->new_values['roles'])->toBe(['reviewer']);
});

test('the bulk assign-role action logs each affected target\'s identity', function () {
    $admin = ualt_admin();
    $targetA = User::factory()->create(['name' => 'Bulk A']);
    $targetA->assignRole('staff');
    $targetB = User::factory()->create(['name' => 'Bulk B']);
    $targetB->assignRole('staff');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/users/bulk', [
            'action' => 'assign_role',
            'ids' => [$targetA->id, $targetB->id],
            'role' => 'reviewer',
        ])
        ->assertOk();

    $logA = AuditLog::where('event', 'user.role_changed')->where('auditable_id', $targetA->id)->firstOrFail();
    $logB = AuditLog::where('event', 'user.role_changed')->where('auditable_id', $targetB->id)->firstOrFail();

    expect($logA->new_values['target_name'])->toBe('Bulk A')
        ->and($logB->new_values['target_name'])->toBe('Bulk B');
});
