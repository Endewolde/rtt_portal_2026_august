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

        $role = Role::findByName('central_officer');

        $missing = [
            'proposal_calls.export',
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'midterm_evaluations.create',   'midterm_evaluations.update',
            'completion_workshops.view_any', 'completion_workshops.view',
            'completion_workshops.create',  'completion_workshops.update',
            'research_outputs.view_any',    'research_outputs.view',
            'research_outputs.update',
            'disbursements.view_any',       'disbursements.view',
            'settlements.view_any',         'settlements.view',
            'settlements.update',
            'repository.view_any',          'repository.view',
            'repository.export',
        ];

        foreach ($missing as $name) {
            $permission = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            if (! $role->hasPermissionTo($permission)) {
                $role->givePermissionTo($permission);
            }
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $role = Role::findByName('central_officer');

        $added = [
            'proposal_calls.export',
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'midterm_evaluations.create',   'midterm_evaluations.update',
            'completion_workshops.view_any', 'completion_workshops.view',
            'completion_workshops.create',  'completion_workshops.update',
            'research_outputs.view_any',    'research_outputs.view',
            'research_outputs.update',
            'disbursements.view_any',       'disbursements.view',
            'settlements.view_any',         'settlements.view',
            'settlements.update',
            'repository.view_any',          'repository.view',
            'repository.export',
        ];

        $role->revokePermissionTo($added);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
