<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * A call can set its own review route: skip open defence, its own pass marks,
     * and how many reviewers a decision waits for. Skipping defence needs one new
     * workflow step, blind_review_passed → accepted.
     */
    public function up(): void
    {
        Schema::table('proposal_calls', function (Blueprint $table) {
            $table->json('review_route')->nullable()->after('application_form');
        });

        $from = DB::table('workflow_stages')->where('name', 'blind_review_passed')->value('id');
        $to = DB::table('workflow_stages')->where('name', 'accepted')->value('id');
        if (! $from || ! $to) {
            return;
        }

        $actionId = DB::table('workflow_actions')->where('name', 'skip_defence')->value('id');
        if (! $actionId) {
            $actionId = (string) Str::uuid();
            DB::table('workflow_actions')->insert([
                'id' => $actionId, 'name' => 'skip_defence', 'label' => 'Skip Defence', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        if (! DB::table('workflow_transitions')->where('from_stage_id', $from)->where('action_id', $actionId)->exists()) {
            DB::table('workflow_transitions')->insert([
                'id' => (string) Str::uuid(), 'from_stage_id' => $from, 'action_id' => $actionId, 'to_stage_id' => $to,
                'allowed_roles' => json_encode(['central_officer', 'super_admin', 'admin', 'research_officer', 'community_officer', 'technology_officer', 'college_rtt_manager']),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $actionId = DB::table('workflow_actions')->where('name', 'skip_defence')->value('id');
        if ($actionId) {
            DB::table('workflow_transitions')->where('action_id', $actionId)->delete();
            DB::table('workflow_actions')->where('id', $actionId)->delete();
        }

        Schema::table('proposal_calls', function (Blueprint $table) {
            $table->dropColumn('review_route');
        });
    }
};
