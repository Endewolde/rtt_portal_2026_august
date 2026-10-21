<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Same permission set as RolePermissionSeeder grants the role, so environments
     * that only run `php artisan migrate` (production) get it without a reseed.
     *
     * @var list<string>
     */
    private const PERMISSIONS = [
        'proposals.view_any', 'proposals.view', 'proposals.export',
        'proposal_calls.view_any', 'proposal_calls.view',
        'reviews.view_any', 'reviews.view',
        'review_assignments.view_any', 'review_assignments.view',
        'defence_sessions.view_any', 'defence_sessions.view',
        'awards.view_any', 'awards.view', 'awards.create', 'awards.update',
        'budget_allocations.view_any', 'budget_allocations.view',
        'budget_requests.view_any', 'budget_requests.view',
        'reports.view_any', 'reports.view', 'reports.create', 'reports.export',
        'research_impacts.view_any', 'research_impacts.view',
        'budget_milestones.view_any', 'budget_milestones.view',
        'midterm_evaluations.view_any', 'midterm_evaluations.view',
        'completion_workshops.view_any', 'completion_workshops.view',
        'research_outputs.view_any', 'research_outputs.view',
        'proposal_ai_scores.view',
        'lookup_options.view_any', 'lookup_options.view',
        'contracts.download',
    ];

    /** Workflow steps of the central evaluation and funding phase the role may take. */
    private const ACTIONS = ['central_approve', 'central_reject', 'fund', 'revoke_funding'];

    private const ROLE = 'college_rtt_manager';

    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', self::ROLE)->where('guard_name', 'web')->value('id')
            ?? DB::table('roles')->insertGetId([
                'name' => self::ROLE, 'guard_name' => 'web', 'created_at' => now(), 'updated_at' => now(),
            ]);

        $permissionIds = DB::table('permissions')->where('guard_name', 'web')->whereIn('name', self::PERMISSIONS)->pluck('id');
        $existing = DB::table('role_has_permissions')->where('role_id', $roleId)->pluck('permission_id');

        DB::table('role_has_permissions')->insert(
            $permissionIds->diff($existing)->map(fn ($id) => ['role_id' => $roleId, 'permission_id' => $id])->values()->all()
        );

        $this->ensureRevokeFundingTransition();

        $this->eachTransition(function (object $transition, array $roles) {
            return in_array(self::ROLE, $roles, true) ? null : [...$roles, self::ROLE];
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * "Revoke Funding" (funded → rejected) was only ever created by hand on some
     * databases; make sure it exists everywhere the controller relies on it.
     */
    private function ensureRevokeFundingTransition(): void
    {
        $schema = DB::getSchemaBuilder();
        if (! $schema->hasTable('workflow_transitions') || ! $schema->hasTable('workflow_actions') || ! $schema->hasTable('workflow_stages')) {
            return;
        }

        $from = DB::table('workflow_stages')->where('name', 'funded')->value('id');
        $to = DB::table('workflow_stages')->where('name', 'rejected')->value('id');
        if (! $from || ! $to) {
            return;
        }

        $actionId = DB::table('workflow_actions')->where('name', 'revoke_funding')->value('id');
        if (! $actionId) {
            $actionId = (string) Str::uuid();
            DB::table('workflow_actions')->insert([
                'id' => $actionId, 'name' => 'revoke_funding', 'label' => 'Revoke Funding', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        if (! DB::table('workflow_transitions')->where('from_stage_id', $from)->where('action_id', $actionId)->exists()) {
            DB::table('workflow_transitions')->insert([
                'id' => (string) Str::uuid(), 'from_stage_id' => $from, 'action_id' => $actionId, 'to_stage_id' => $to,
                'allowed_roles' => json_encode(['super_admin', 'central_officer']), 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $this->eachTransition(function (object $transition, array $roles) {
            return in_array(self::ROLE, $roles, true) ? array_values(array_diff($roles, [self::ROLE])) : null;
        });

        $roleId = DB::table('roles')->where('name', self::ROLE)->value('id');
        if ($roleId) {
            DB::table('role_has_permissions')->where('role_id', $roleId)->delete();
            DB::table('model_has_roles')->where('role_id', $roleId)->delete();
            DB::table('roles')->where('id', $roleId)->delete();
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** @param callable(object, list<string>): ?list<string> $change returns the new roles, or null to leave it */
    private function eachTransition(callable $change): void
    {
        if (! DB::getSchemaBuilder()->hasTable('workflow_transitions')) {
            return;
        }

        $transitions = DB::table('workflow_transitions as t')
            ->join('workflow_actions as a', 'a.id', '=', 't.action_id')
            ->whereIn('a.name', self::ACTIONS)
            ->get(['t.id', 't.allowed_roles']);

        foreach ($transitions as $transition) {
            $roles = json_decode($transition->allowed_roles ?? '[]', true) ?: [];
            $updated = $change($transition, $roles);
            if ($updated !== null) {
                DB::table('workflow_transitions')->where('id', $transition->id)->update(['allowed_roles' => json_encode($updated)]);
            }
        }
    }
};
