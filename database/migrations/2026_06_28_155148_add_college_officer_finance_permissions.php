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

        $new = [
            'disbursements.view_any', 'disbursements.view',
            'disbursements.create',   'disbursements.update',
            'settlements.view_any',   'settlements.view',
            'settlements.create',     'settlements.update',
        ];

        foreach ($new as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        $role = Role::findByName('college_officer');
        $role->givePermissionTo($new);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $role = Role::findByName('college_officer');
        $role->revokePermissionTo([
            'disbursements.view_any', 'disbursements.view',
            'disbursements.create',   'disbursements.update',
            'settlements.view_any',   'settlements.view',
            'settlements.create',     'settlements.update',
        ]);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
