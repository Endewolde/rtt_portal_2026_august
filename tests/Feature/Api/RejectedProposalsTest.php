<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();
    DB::table('app_settings')->where('key', 'current_academic_year')->update(['value' => '2026-2027']);

    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
    $this->college = College::create(['name' => 'College A', 'code' => 'RJA'.rand(1000, 9999), 'status' => 'active']);
});

function rj_rejected(object $ctx, string $fromStage, string $action, array $metadata = [], ?College $college = null): Proposal
{
    $college ??= $ctx->college;
    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RJD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'rj-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $ctx->admin->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'RJ-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'rejected', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026-2027', 'created_by' => $pi->id,
    ]);
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id, 'from_stage' => $fromStage, 'action' => $action,
        'to_stage' => 'rejected', 'actor_id' => $ctx->admin->id, 'notes' => "Rejected via {$action}",
        'metadata' => $metadata ? json_encode($metadata) : null, 'created_at' => now(),
    ]);

    return $proposal;
}

test('every rejected proposal is listed with how it was rejected and where restoring takes it back to', function () {
    $atValidation = rj_rejected($this, 'submitted', 'reject');
    $blind = rj_rejected($this, 'under_blind_review', 'fail_blind_review', ['automatic' => true]);
    $noShow = rj_rejected($this, 'under_open_defence', 'fail_defence', ['automatic' => true, 'no_show' => true]);
    $revoked = rj_rejected($this, 'funded', 'revoke_funding');

    $data = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/rejected-proposals')->assertOk()->json('data');
    $rows = collect($data['proposals'])->keyBy('id');

    expect($rows)->toHaveCount(4)
        ->and($rows[$atValidation->id]['kind'])->toBe('validation')
        ->and($rows[$atValidation->id]['restore_to'])->toBe('submitted')
        ->and($rows[$blind->id]['kind'])->toBe('blind_review')
        ->and($rows[$blind->id]['automatic'])->toBeTrue()
        ->and($rows[$noShow->id]['kind'])->toBe('no_show')
        ->and($rows[$noShow->id]['restore_to'])->toBe('under_open_defence')
        ->and($rows[$revoked->id]['kind'])->toBe('funding_revoked')
        ->and($rows[$revoked->id]['restore_to'])->toBe('funded')
        ->and($data['can_restore'])->toBeTrue()
        ->and($data['counts'])->toMatchArray(['validation' => 1, 'blind_review' => 1, 'no_show' => 1, 'funding_revoked' => 1]);
});

test('restoring a listed proposal returns it to the stage it was rejected from and takes it off the list', function () {
    $proposal = rj_rejected($this, 'under_blind_review', 'fail_blind_review');

    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/reopen", ['reason' => 'Rejected by mistake — restoring for reconsideration.'])
        ->assertOk();

    expect($proposal->fresh()->status)->toBe('under_blind_review')
        ->and($this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/rejected-proposals')->json('data.proposals'))->toBe([]);
});

test('a college officer sees only their own college\'s rejected proposals', function () {
    $other = College::create(['name' => 'College B', 'code' => 'RJB'.rand(1000, 9999), 'status' => 'active']);
    $own = rj_rejected($this, 'submitted', 'reject');
    rj_rejected($this, 'submitted', 'reject', [], $other);
    $officer = User::factory()->create(['college_id' => $this->college->id]);
    $officer->assignRole('college_officer');

    $ids = collect($this->actingAs($officer, 'sanctum')->getJson('/api/v1/rejected-proposals?college_id='.$other->id)->assertOk()->json('data.proposals'))->pluck('id');

    expect($ids->all())->toBe([$own->id]);
});

test('staff cannot open the rejected proposals list', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->getJson('/api/v1/rejected-proposals')->assertForbidden();
});

/** Validated after the old reviewer-removal bug: a blind review was submitted with this score (out of 5) but never applied. */
function rj_unapplied(object $ctx, int $score): Proposal
{
    $proposal = rj_rejected($ctx, 'submitted', 'reject');
    DB::table('workflow_logs')->where('proposal_id', $proposal->id)->delete();
    $proposal->forceFill(['status' => 'validated'])->saveQuietly();
    foreach ([['validate', 'submitted', 'validated', 3], ['assign_for_review', 'validated', 'under_blind_review', 2], ['unassign_reviewers', 'under_blind_review', 'validated', 1]] as [$action, $from, $to, $ago]) {
        DB::table('workflow_logs')->insert([
            'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id, 'from_stage' => $from, 'action' => $action,
            'to_stage' => $to, 'actor_id' => $ctx->admin->id, 'notes' => null, 'metadata' => null, 'created_at' => now()->subMinutes($ago),
        ]);
    }

    $type = EvaluationType::create(['name' => 'blind_review_rj_'.rand(1000, 9999), 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'Cat', 'order_index' => 1, 'weight' => 100]);
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $ctx->admin->id, 'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    foreach (range(1, 4) as $i) {
        $question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => "Q{$i}", 'max_score' => 5, 'weight' => 1.00, 'is_required' => true, 'order_index' => $i]);
        ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $question->id, 'score' => $score]);
    }

    return $proposal;
}

test('a proposal sent back to validated with a submitted blind review is listed with its result and what restoring will do', function () {
    $proposal = rj_unapplied($this, 4);

    $unapplied = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/rejected-proposals')->assertOk()->json('data.unapplied');

    expect($unapplied)->toHaveCount(1)
        ->and($unapplied[0]['id'])->toBe($proposal->id)
        ->and($unapplied[0]['score_label'])->toBe('80/100')
        ->and($unapplied[0]['outcome'])->toBe('pass');
});

test('restoring applies the blind review result — a passing proposal moves on to open defence and leaves the list', function () {
    $proposal = rj_unapplied($this, 4);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/restore-blind-review")
        ->assertOk()
        ->assertJsonPath('data.status', 'blind_review_passed');

    expect($proposal->fresh()->status)->toBe('blind_review_passed')
        ->and($this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/rejected-proposals')->json('data.unapplied'))->toBe([]);
});

test('only a proposal with an unapplied blind review result can be restored this way, and only by someone who may restore', function () {
    $notStuck = rj_rejected($this, 'submitted', 'reject');
    $stuck = rj_unapplied($this, 4);
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/proposals/{$notStuck->id}/restore-blind-review")->assertStatus(422);
    $this->actingAs($staff, 'sanctum')->postJson("/api/v1/proposals/{$stuck->id}/restore-blind-review")->assertForbidden();

    expect($stuck->fresh()->status)->toBe('validated');
});
