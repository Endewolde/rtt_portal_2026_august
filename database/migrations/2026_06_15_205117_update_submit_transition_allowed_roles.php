<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // "pi" is a ProposalMember role, not a real user role. Faculty/researchers hold roles like
        // college_officer, research_officer, etc. and were blocked from submitting with a 500 error.
        DB::statement("
            UPDATE workflow_transitions
            SET allowed_roles = ?
            WHERE from_stage_id = (SELECT id FROM workflow_stages WHERE name = 'draft' LIMIT 1)
              AND action_id     = (SELECT id FROM workflow_actions WHERE name = 'submit' LIMIT 1)
        ", [json_encode([
            'staff',
            'college_officer',
            'research_officer',
            'community_officer',
            'technology_officer',
            'support_officer',
            'central_officer',
            'admin',
            'super_admin',
        ])]);
    }

    public function down(): void
    {
        DB::statement("
            UPDATE workflow_transitions
            SET allowed_roles = ?
            WHERE from_stage_id = (SELECT id FROM workflow_stages WHERE name = 'draft' LIMIT 1)
              AND action_id     = (SELECT id FROM workflow_actions WHERE name = 'submit' LIMIT 1)
        ", [json_encode(['pi', 'super_admin', 'central_officer', 'staff'])]);
    }
};
