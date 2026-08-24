<?php

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

test('role management permissions stay dead-code-free — only roles.assign is granted', function () {
    (new RolePermissionSeeder)->run();

    foreach (['roles.view_any', 'roles.view', 'roles.create', 'roles.update', 'roles.delete'] as $dead) {
        expect(Permission::where('name', $dead)->exists())->toBeFalse(
            "{$dead} should not exist — RoleController hard-gates role management to hasRole('super_admin'), so this permission has no effect anywhere."
        );
    }

    expect(Permission::where('name', 'roles.assign')->exists())->toBeTrue();

    $admin = Role::findByName('admin', 'web');
    expect($admin->hasPermissionTo('roles.assign'))->toBeTrue();
});

test('re-running the seeder removes a permission that was dropped from the map, cascading off any role that held it', function () {
    (new RolePermissionSeeder)->run();

    // Simulate a permission that existed before some future map change removed it.
    $stale = Permission::create(['name' => 'proposals.some_removed_action', 'guard_name' => 'web']);
    $admin = Role::findByName('admin', 'web');
    $admin->givePermissionTo($stale);
    expect($admin->hasPermissionTo('proposals.some_removed_action'))->toBeTrue();

    (new RolePermissionSeeder)->run();

    // The permission row is gone entirely (not just unassigned) — Spatie's own
    // hasPermissionTo() would throw PermissionDoesNotExist rather than return false
    // for a permission that no longer exists at all, so the row's absence plus the
    // pivot table both being clear is the real assertion here.
    expect(Permission::where('name', 'proposals.some_removed_action')->exists())->toBeFalse();
    $this->assertDatabaseMissing('role_has_permissions', ['permission_id' => $stale->id]);
});

test('every permission in the seeder map still exists after re-running the seeder twice', function () {
    (new RolePermissionSeeder)->run();
    $firstRun = Permission::pluck('name')->sort()->values();

    (new RolePermissionSeeder)->run();
    $secondRun = Permission::pluck('name')->sort()->values();

    expect($secondRun->all())->toBe($firstRun->all());
    expect($firstRun->count())->toBeGreaterThan(100);
});
