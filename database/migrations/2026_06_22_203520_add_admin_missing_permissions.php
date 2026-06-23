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

        $role = Role::findByName('admin');

        $missing = [
            'proposals.review', 'proposals.track',
            'proposal_calls.export',
            'reviews.delete',
            'review_assignments.delete',
            'defence_sessions.delete',
            'budget_allocations.delete',
            'budget_requests.create', 'budget_requests.update', 'budget_requests.delete',
            'disbursements.create', 'disbursements.update',
            'settlements.create', 'settlements.update',
            'users.delete', 'users.impersonate',
            'roles.delete',
            'colleges.delete',
            'departments.delete',
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'midterm_evaluations.create', 'midterm_evaluations.update', 'midterm_evaluations.delete',
            'completion_workshops.view_any', 'completion_workshops.view',
            'completion_workshops.create', 'completion_workshops.update', 'completion_workshops.delete',
            'research_outputs.view_any', 'research_outputs.view',
            'research_outputs.create', 'research_outputs.update', 'research_outputs.delete',
            'repository.view_any', 'repository.view', 'repository.export',
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

        $role = Role::findByName('admin');

        $role->revokePermissionTo([
            'proposals.review', 'proposals.track',
            'proposal_calls.export',
            'reviews.delete',
            'review_assignments.delete',
            'defence_sessions.delete',
            'budget_allocations.delete',
            'budget_requests.create', 'budget_requests.update', 'budget_requests.delete',
            'disbursements.create', 'disbursements.update',
            'settlements.create', 'settlements.update',
            'users.delete', 'users.impersonate',
            'roles.delete',
            'colleges.delete',
            'departments.delete',
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'midterm_evaluations.create', 'midterm_evaluations.update', 'midterm_evaluations.delete',
            'completion_workshops.view_any', 'completion_workshops.view',
            'completion_workshops.create', 'completion_workshops.update', 'completion_workshops.delete',
            'research_outputs.view_any', 'research_outputs.view',
            'research_outputs.create', 'research_outputs.update', 'research_outputs.delete',
            'repository.view_any', 'repository.view', 'repository.export',
        ]);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
