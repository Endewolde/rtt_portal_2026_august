<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    /**
     * Role hierarchy (highest to lowest privilege):
     *   super_admin → admin → central_officer
     *   → research_officer / community_officer / technology_officer
     *   → college_officer → support_officer → staff
     */
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $this->createPermissions();
        $this->createRoles();
        $this->assignPermissions();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    private function createPermissions(): void
    {
        $map = [
            'proposals' => ['view_any', 'view', 'create', 'update', 'delete', 'export', 'submit', 'validate', 'assign_reviewer', 'review', 'track'],
            'proposal_calls' => ['view_any', 'view', 'create', 'update', 'delete', 'export'],
            'reviews' => ['view_any', 'view', 'create', 'update', 'delete'],
            'review_assignments' => ['view_any', 'view', 'create', 'update', 'delete'],
            'defence_sessions' => ['view_any', 'view', 'create', 'update', 'delete'],
            'complaints' => ['view_any', 'view', 'create', 'update', 'delete'],
            'budget_allocations' => ['view_any', 'view', 'create', 'update', 'delete'],
            'budget_requests' => ['view_any', 'view', 'create', 'update', 'delete', 'export'],
            'budget_milestones' => ['view_any', 'view', 'create', 'update', 'delete'],
            'disbursements' => ['view_any', 'view', 'create', 'update', 'delete'],
            'settlements' => ['view_any', 'view', 'create', 'update', 'delete'],
            'midterm_evaluations' => ['view_any', 'view', 'create', 'update', 'delete'],
            'completion_workshops' => ['view_any', 'view', 'create', 'update', 'delete'],
            'research_outputs' => ['view_any', 'view', 'create', 'update', 'delete'],
            'research_impacts' => ['view_any', 'view', 'create', 'update', 'delete'],
            'proposal_ai_scores' => ['view', 'generate'],
            'reviewer_match' => ['view'],
            'lookup_options' => ['view_any', 'view', 'create', 'update', 'delete', 'reorder'],
            'repository' => ['view_any', 'view', 'export'],
            'reports' => ['view_any', 'view', 'create', 'export'],
            'users' => ['view_any', 'view', 'create', 'update', 'delete', 'import', 'impersonate'],
            'roles' => ['view_any', 'view', 'create', 'update', 'delete', 'assign'],
            'colleges' => ['view_any', 'view', 'create', 'update', 'delete'],
            'departments' => ['view_any', 'view', 'create', 'update', 'delete'],
            'settings' => ['view_any', 'view', 'update', 'manage'],
            'awards' => ['view_any', 'view', 'create', 'update'],
            'audit_logs' => ['view_any', 'view'],
            'system_monitor' => ['view_any'],
            'features' => ['view_any', 'manage'],
            'external_funds' => [
                'view_any', 'view', 'create', 'update', 'delete', 'export',
                'manage_agencies', 'manage_opportunities', 'review', 'manage_awards',
            ],
        ];

        foreach ($map as $resource => $actions) {
            foreach ($actions as $action) {
                Permission::updateOrCreate(
                    ['name' => "{$resource}.{$action}", 'guard_name' => 'web'],
                    ['name' => "{$resource}.{$action}", 'guard_name' => 'web'],
                );
            }
        }
    }

    private function createRoles(): void
    {
        $roles = [
            'super_admin',
            'admin',
            'central_officer',
            'research_officer',
            'community_officer',
            'technology_officer',
            'college_officer',
            'finance_officer',
            'support_officer',
            'staff',
            'pi',
            'reviewer',
            'external_reviewer',
            'proposal_archivist',
            'guest',
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['name' => $role, 'guard_name' => 'web'],
                ['name' => $role, 'guard_name' => 'web'],
            );
        }
    }

    private function assignPermissions(): void
    {
        $all = Permission::all();

        // ── super_admin: everything ───────────────────────────────────────────
        Role::findByName('super_admin', 'web')->syncPermissions($all);

        // ── admin: site management (users, roles, settings, features) ─────────
        Role::findByName('admin', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.create', 'proposals.update',
            'proposals.delete', 'proposals.export', 'proposals.submit',
            'proposals.validate', 'proposals.assign_reviewer', 'proposals.review', 'proposals.track',
            'proposal_calls.view_any', 'proposal_calls.view', 'proposal_calls.create',
            'proposal_calls.update', 'proposal_calls.delete', 'proposal_calls.export',
            'reviews.view_any', 'reviews.view', 'reviews.create', 'reviews.update', 'reviews.delete',
            'review_assignments.view_any', 'review_assignments.view',
            'review_assignments.create', 'review_assignments.update', 'review_assignments.delete',
            'defence_sessions.view_any', 'defence_sessions.view',
            'defence_sessions.create', 'defence_sessions.update', 'defence_sessions.delete',
            'complaints.view_any', 'complaints.view', 'complaints.update', 'complaints.delete',
            'budget_allocations.view_any', 'budget_allocations.view',
            'budget_allocations.create', 'budget_allocations.update', 'budget_allocations.delete',
            'budget_requests.view_any', 'budget_requests.view', 'budget_requests.export',
            'budget_requests.create', 'budget_requests.update', 'budget_requests.delete',
            'disbursements.view_any', 'disbursements.view', 'disbursements.create', 'disbursements.update', 'disbursements.delete',
            'settlements.view_any', 'settlements.view', 'settlements.create', 'settlements.update', 'settlements.delete',
            'reports.view_any', 'reports.view', 'reports.create', 'reports.export',
            'awards.view_any', 'awards.view', 'awards.create', 'awards.update',
            'users.view_any', 'users.view', 'users.create', 'users.update',
            'users.import', 'users.delete', 'users.impersonate',
            'roles.view_any', 'roles.view', 'roles.create', 'roles.update', 'roles.assign', 'roles.delete',
            'colleges.view_any', 'colleges.view', 'colleges.create', 'colleges.update', 'colleges.delete',
            'departments.view_any', 'departments.view', 'departments.create', 'departments.update', 'departments.delete',
            'settings.view_any', 'settings.view', 'settings.update', 'settings.manage',
            'audit_logs.view_any', 'audit_logs.view',
            'system_monitor.view_any',
            'features.view_any', 'features.manage',
            'external_funds.view_any', 'external_funds.view', 'external_funds.create',
            'external_funds.update', 'external_funds.delete', 'external_funds.export',
            'external_funds.manage_agencies', 'external_funds.manage_opportunities',
            'external_funds.review', 'external_funds.manage_awards',
            // Monitoring & post-award
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'midterm_evaluations.create', 'midterm_evaluations.update', 'midterm_evaluations.delete',
            'completion_workshops.view_any', 'completion_workshops.view',
            'completion_workshops.create', 'completion_workshops.update', 'completion_workshops.delete',
            'research_outputs.view_any', 'research_outputs.view',
            'research_outputs.create', 'research_outputs.update', 'research_outputs.delete',
            'research_impacts.view_any', 'research_impacts.view',
            'research_impacts.create', 'research_impacts.update', 'research_impacts.delete',
            'budget_milestones.view_any', 'budget_milestones.view',
            'budget_milestones.create', 'budget_milestones.update', 'budget_milestones.delete',
            'repository.view_any', 'repository.view', 'repository.export',
            // AI & matching
            'proposal_ai_scores.view', 'proposal_ai_scores.generate',
            'reviewer_match.view',
            // Lookup options management
            'lookup_options.view_any', 'lookup_options.view',
            'lookup_options.create', 'lookup_options.update', 'lookup_options.delete', 'lookup_options.reorder',
        ]);

        // ── central_officer: cross-college oversight ──────────────────────────
        Role::findByName('central_officer', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.update', 'proposals.export',
            'proposals.validate', 'proposals.assign_reviewer', 'proposals.review',
            'proposal_calls.view_any', 'proposal_calls.view', 'proposal_calls.create',
            'proposal_calls.update', 'proposal_calls.delete', 'proposal_calls.export',
            'reviews.view_any', 'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view',
            'review_assignments.create', 'review_assignments.update',
            'defence_sessions.view_any', 'defence_sessions.view',
            'defence_sessions.create', 'defence_sessions.update',
            'complaints.view_any', 'complaints.view', 'complaints.update', 'complaints.delete',
            'budget_allocations.view_any', 'budget_allocations.view',
            'budget_allocations.create', 'budget_allocations.update',
            'budget_requests.view_any', 'budget_requests.view', 'budget_requests.export',
            'reports.view_any', 'reports.view', 'reports.create', 'reports.export',
            'awards.view_any', 'awards.view', 'awards.create', 'awards.update',
            'users.view_any', 'users.view',
            'audit_logs.view_any', 'audit_logs.view',
            'system_monitor.view_any',
            'external_funds.view_any', 'external_funds.view', 'external_funds.create',
            'external_funds.update', 'external_funds.export',
            'external_funds.manage_agencies', 'external_funds.manage_opportunities',
            'external_funds.review', 'external_funds.manage_awards',
            // Monitoring & post-award oversight
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'midterm_evaluations.create', 'midterm_evaluations.update',
            'completion_workshops.view_any', 'completion_workshops.view',
            'completion_workshops.create', 'completion_workshops.update',
            'research_outputs.view_any', 'research_outputs.view', 'research_outputs.update',
            'research_impacts.view_any', 'research_impacts.view',
            'research_impacts.create', 'research_impacts.update',
            'budget_milestones.view_any', 'budget_milestones.view',
            'budget_milestones.create', 'budget_milestones.update',
            // Finance oversight
            'disbursements.view_any', 'disbursements.view',
            'settlements.view_any', 'settlements.view', 'settlements.update',
            // Repository & data
            'repository.view_any', 'repository.view', 'repository.export',
            // AI & matching
            'proposal_ai_scores.view', 'proposal_ai_scores.generate',
            'reviewer_match.view',
            // Lookup options (read-only for officers)
            'lookup_options.view_any', 'lookup_options.view',
        ]);

        // ── research_officer ─────────────────────────────────────────────────
        Role::findByName('research_officer', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.update',
            'proposals.validate', 'proposals.assign_reviewer', 'proposals.export',
            'proposal_calls.view_any', 'proposal_calls.view',
            'proposal_calls.create', 'proposal_calls.update',
            'reviews.view_any', 'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view',
            'review_assignments.create', 'review_assignments.update',
            'defence_sessions.view_any', 'defence_sessions.view',
            'defence_sessions.create', 'defence_sessions.update',
            'awards.view_any', 'awards.view', 'awards.create', 'awards.update',
            'budget_allocations.view_any', 'budget_allocations.view',
            'budget_allocations.create', 'budget_allocations.update',
            'budget_requests.view_any', 'budget_requests.view',
            'reports.view_any', 'reports.view', 'reports.create', 'reports.export',
            'complaints.view_any', 'complaints.view', 'complaints.update',
            'users.view_any', 'users.view',
            'external_funds.view_any', 'external_funds.view', 'external_funds.create',
            'external_funds.update', 'external_funds.export',
            'external_funds.manage_agencies', 'external_funds.manage_opportunities',
            'external_funds.review', 'external_funds.manage_awards',
            // Impact & milestones
            'research_impacts.view_any', 'research_impacts.view',
            'research_impacts.create', 'research_impacts.update',
            'budget_milestones.view_any', 'budget_milestones.view',
            // AI & matching
            'proposal_ai_scores.view', 'proposal_ai_scores.generate',
            'reviewer_match.view',
            'lookup_options.view_any', 'lookup_options.view',
        ]);

        // ── community_officer ────────────────────────────────────────────────
        Role::findByName('community_officer', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.update',
            'proposals.validate', 'proposals.assign_reviewer', 'proposals.export',
            'proposal_calls.view_any', 'proposal_calls.view',
            'proposal_calls.create', 'proposal_calls.update',
            'reviews.view_any', 'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view',
            'review_assignments.create', 'review_assignments.update',
            'defence_sessions.view_any', 'defence_sessions.view',
            'defence_sessions.create', 'defence_sessions.update',
            'awards.view_any', 'awards.view', 'awards.create', 'awards.update',
            'budget_allocations.view_any', 'budget_allocations.view',
            'budget_allocations.create', 'budget_allocations.update',
            'budget_requests.view_any', 'budget_requests.view',
            'reports.view_any', 'reports.view', 'reports.create', 'reports.export',
            'complaints.view_any', 'complaints.view', 'complaints.update',
            'users.view_any', 'users.view',
            // Impact & milestones
            'research_impacts.view_any', 'research_impacts.view',
            'research_impacts.create', 'research_impacts.update',
            'budget_milestones.view_any', 'budget_milestones.view',
            // AI & matching
            'proposal_ai_scores.view', 'proposal_ai_scores.generate',
            'reviewer_match.view',
            'lookup_options.view_any', 'lookup_options.view',
        ]);

        // ── technology_officer ───────────────────────────────────────────────
        Role::findByName('technology_officer', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.update',
            'proposals.validate', 'proposals.assign_reviewer', 'proposals.export',
            'proposal_calls.view_any', 'proposal_calls.view',
            'proposal_calls.create', 'proposal_calls.update',
            'reviews.view_any', 'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view',
            'review_assignments.create', 'review_assignments.update',
            'defence_sessions.view_any', 'defence_sessions.view',
            'defence_sessions.create', 'defence_sessions.update',
            'awards.view_any', 'awards.view', 'awards.create', 'awards.update',
            'budget_allocations.view_any', 'budget_allocations.view',
            'budget_allocations.create', 'budget_allocations.update',
            'budget_requests.view_any', 'budget_requests.view',
            'reports.view_any', 'reports.view', 'reports.create', 'reports.export',
            'complaints.view_any', 'complaints.view', 'complaints.update',
            'users.view_any', 'users.view',
            // Impact & milestones
            'research_impacts.view_any', 'research_impacts.view',
            'research_impacts.create', 'research_impacts.update',
            'budget_milestones.view_any', 'budget_milestones.view',
            // AI & matching
            'proposal_ai_scores.view', 'proposal_ai_scores.generate',
            'reviewer_match.view',
            'lookup_options.view_any', 'lookup_options.view',
        ]);

        // ── college_officer: college-scoped management ───────────────────────
        Role::findByName('college_officer', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.update', 'proposals.export',
            'proposal_calls.view_any', 'proposal_calls.view',
            'reviews.view_any', 'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view',
            'review_assignments.create', 'review_assignments.update',
            'defence_sessions.view_any', 'defence_sessions.view',
            'defence_sessions.create', 'defence_sessions.update',
            'budget_requests.view_any', 'budget_requests.view', 'budget_requests.update',
            'budget_allocations.view_any', 'budget_allocations.view',
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'midterm_evaluations.create', 'midterm_evaluations.update',
            'completion_workshops.view_any', 'completion_workshops.view',
            'completion_workshops.create', 'completion_workshops.update',
            'research_outputs.view_any', 'research_outputs.view',
            'reports.view_any', 'reports.view',
            'complaints.view_any', 'complaints.view', 'complaints.update',
            'departments.view_any', 'departments.view',
            'users.view_any', 'users.view',
            // Impact (read), AI scoring & reviewer matching
            'research_impacts.view_any', 'research_impacts.view',
            'budget_milestones.view_any', 'budget_milestones.view',
            'proposal_ai_scores.view', 'proposal_ai_scores.generate',
            'reviewer_match.view',
            'lookup_options.view_any', 'lookup_options.view',
            'disbursements.view_any', 'disbursements.view',
            'disbursements.create', 'disbursements.update',
            'settlements.view_any', 'settlements.view',
            'settlements.create', 'settlements.update',
        ]);

        // ── finance_officer: college-scoped budget approvals & disbursements ────
        Role::findByName('finance_officer', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view',
            'budget_requests.view_any', 'budget_requests.view', 'budget_requests.update', 'budget_requests.export',
            'disbursements.view_any', 'disbursements.view', 'disbursements.create', 'disbursements.update',
            'settlements.view_any', 'settlements.view', 'settlements.update',
            'budget_allocations.view_any', 'budget_allocations.view',
            'reports.view_any', 'reports.view',
            'complaints.view_any', 'complaints.view',
            'external_funds.view_any', 'external_funds.view',
            'external_funds.manage_awards', 'external_funds.export',
            // Budget milestones for finance oversight
            'budget_milestones.view_any', 'budget_milestones.view',
            'budget_milestones.create', 'budget_milestones.update',
        ]);

        // ── support_officer: finance & support tasks ─────────────────────────
        Role::findByName('support_officer', 'web')->syncPermissions([
            'budget_requests.view_any', 'budget_requests.view', 'budget_requests.export',
            'disbursements.view_any', 'disbursements.view', 'disbursements.create', 'disbursements.update',
            'settlements.view_any', 'settlements.view', 'settlements.update',
            'budget_allocations.view_any', 'budget_allocations.view',
            'budget_milestones.view_any', 'budget_milestones.view',
            'budget_milestones.create', 'budget_milestones.update',
            'reports.view_any', 'reports.view',
            'proposals.view_any', 'proposals.view',
            'complaints.view_any', 'complaints.view',
        ]);

        // ── reviewer: scoped read access for assigned proposals & reviews ────
        Role::findByName('reviewer', 'web')->syncPermissions([
            'proposals.view',
            'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view', 'review_assignments.update',
            'proposal_calls.view',
        ]);

        // ── external_reviewer: same scope as reviewer, for reviewers outside the
        //    institution — deliberately excludes anything beyond reviewing (no
        //    proposal creation, budgets, or admin pages) ───────────────────────
        Role::findByName('external_reviewer', 'web')->syncPermissions([
            'proposals.view',
            'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view', 'review_assignments.update',
            'proposal_calls.view',
        ]);

        // ── pi: proposal submission & tracking ────────────────────────────────
        Role::findByName('pi', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.create',
            'proposals.update', 'proposals.submit', 'proposals.track',
            'proposal_calls.view_any', 'proposal_calls.view',
            'budget_requests.view_any', 'budget_requests.view',
            'budget_requests.create', 'budget_requests.update',
            'budget_milestones.view_any', 'budget_milestones.view',
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'completion_workshops.view_any', 'completion_workshops.view',
            'research_outputs.view_any', 'research_outputs.view',
            'research_outputs.create', 'research_outputs.update',
            'research_impacts.view_any', 'research_impacts.view',
            'research_impacts.create', 'research_impacts.update',
            'repository.view_any', 'repository.view',
            'complaints.create', 'complaints.view',
        ]);

        // ── staff: proposal submission & reviews ─────────────────────────────
        Role::findByName('staff', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view', 'proposals.create',
            'proposals.update', 'proposals.submit', 'proposals.track',
            'proposal_calls.view_any', 'proposal_calls.view',
            'reviews.view_any', 'reviews.view', 'reviews.create', 'reviews.update',
            'review_assignments.view_any', 'review_assignments.view', 'review_assignments.update',
            'budget_requests.view_any', 'budget_requests.view',
            'budget_requests.create', 'budget_requests.update',
            'settlements.view_any', 'settlements.view', 'settlements.create',
            'budget_milestones.view_any', 'budget_milestones.view',
            'midterm_evaluations.view_any', 'midterm_evaluations.view',
            'completion_workshops.view_any', 'completion_workshops.view',
            'research_outputs.view_any', 'research_outputs.view',
            'research_outputs.create', 'research_outputs.update',
            'research_impacts.view_any', 'research_impacts.view',
            'research_impacts.create', 'research_impacts.update',
            'repository.view_any', 'repository.view',
            'complaints.create', 'complaints.view',
        ]);

        // ── proposal_archivist: read-only access to proposals ─────────────────
        Role::findByName('proposal_archivist', 'web')->syncPermissions([
            'proposals.view_any', 'proposals.view',
        ]);
    }
}
