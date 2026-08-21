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

        $role = Role::firstOrCreate(['name' => 'external_reviewer', 'guard_name' => 'web']);

        $permissions = [
            'proposals.view',
            'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view', 'review_assignments.update',
            'proposal_calls.view',
        ];

        foreach ($permissions as $name) {
            $role->givePermissionTo(Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']));
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Role::where('name', 'external_reviewer')->delete();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
