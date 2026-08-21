<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::firstOrCreate(['name' => 'review_assignments.view_any', 'guard_name' => 'web']);

        $role = Role::firstOrCreate(['name' => 'reviewer', 'guard_name' => 'web']);
        $role->givePermissionTo('review_assignments.view_any');

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $role = Role::where('name', 'reviewer')->where('guard_name', 'web')->first();
        $role?->revokePermissionTo('review_assignments.view_any');

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
