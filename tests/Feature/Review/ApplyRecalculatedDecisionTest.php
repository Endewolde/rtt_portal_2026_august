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
use App\Models\ThresholdSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 40]);
    ThresholdSetting::updateOrCreate(['key' => 'defence_threshold'], ['value' => 0]);
    ThresholdSetting::updateOrCreate(['key' => 'combined_threshold'], ['value' => 70]);

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
});

function arc_makeProposal(User $creator, string $status): Proposal
{
    $college = College::create(['name' => 'C'.rand(), 'code' => 'AR'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'ARD'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ar-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $creator->id,
    ]);
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    return Proposal::create([
        'tracker_number' => 'AR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

function arc_score(Proposal $proposal, User $actor, string $typePrefix, int $weight, int $score): void
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $type = EvaluationType::create(['name' => $typePrefix.'_ard_'.Str::random(6), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => $weight]);
    $q = EvaluationQuestion::create(['evaluation_category_id' => $cat->id, 'question_text' => 'Q', 'max_score' => $weight, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $actor->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => $score]);
}

function arc_log(Proposal $proposal, User $actor, string $action, string $from, string $to): void
{
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id,
        'from_stage' => $from, 'action' => $action, 'to_stage' => $to,
        'actor_id' => $actor->id, 'notes' => null, 'metadata' => null, 'created_at' => now()->subMinute(),
    ]);
}

/** Blind out of 80 (threshold 40) + defence out of 20 = combined out of 100 (threshold 70). */
function arc_defenceDecided(User $central, string $status, int $blind, int $defence, string $action, string $to): Proposal
{
    $proposal = arc_makeProposal($central, $status);
    arc_score($proposal, $central, 'blind_review', 80, $blind);
    arc_score($proposal, $central, 'open_defence', 20, $defence);
    arc_log($proposal, $central, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');
    arc_log($proposal, $central, $action, 'under_open_defence', $to);

    return $proposal;
}

test('recalculate previews a wrongly-accepted open defence decision as an applicable correction', function () {
    $proposal = arc_defenceDecided($this->central, 'accepted', 50, 10, 'pass_defence', 'accepted'); // 60/100 < 70

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate")
        ->assertOk()
        ->assertJsonPath('data.can_apply_corrections', true)
        ->assertJsonCount(1, 'data.corrections')
        ->assertJsonPath('data.corrections.0.phase', 'open_defence')
        ->assertJsonPath('data.corrections.0.issue', 'wrongly_passed')
        ->assertJsonPath('data.corrections.0.change', 'accepted → rejected')
        ->assertJsonPath('data.corrections.0.applicable', true);
});

test('applying corrects a wrongly-accepted open defence decision to rejected, recorded under the officer', function () {
    $proposal = arc_defenceDecided($this->central, 'accepted', 50, 10, 'pass_defence', 'accepted');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate/apply")
        ->assertOk()
        ->assertJsonPath('data.proposal_status', 'rejected')
        ->assertJsonPath('data.corrected.0.change', 'accepted → rejected');

    $log = DB::table('workflow_logs')->where('proposal_id', $proposal->id)
        ->where('action', 'fail_defence')->where('from_stage', 'accepted')->first();

    expect($proposal->fresh()->status)->toBe('rejected')
        ->and($log->actor_id)->toBe($this->central->id)
        ->and($log->notes)->toContain("Corrected by {$this->central->name}")
        ->and(json_decode($log->metadata, true))->toMatchArray(['manual' => true, 'automatic' => false, 'corrected' => true]);
});

test('applying reinstates a wrongly-rejected open defence decision to central evaluation', function () {
    $proposal = arc_defenceDecided($this->central, 'rejected', 70, 15, 'fail_defence', 'rejected'); // 85/100 >= 70

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate/apply")
        ->assertOk()
        ->assertJsonPath('data.corrected.0.change', 'rejected → accepted');

    expect($proposal->fresh()->status)->toBe('accepted');
});

test('applying corrects a wrongly-passed blind review decision too', function () {
    $proposal = arc_makeProposal($this->central, 'blind_review_passed');
    arc_score($proposal, $this->central, 'blind_review', 80, 30); // 30/80 < 40
    arc_log($proposal, $this->central, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate/apply")
        ->assertOk();

    expect($proposal->fresh()->status)->toBe('rejected');
});

test('a wrongly-accepted proposal that is already funded is reported, not changed', function () {
    $proposal = arc_defenceDecided($this->central, 'funded', 50, 10, 'pass_defence', 'accepted');

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate")
        ->assertJsonPath('data.corrections.0.applicable', false);

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate/apply")
        ->assertStatus(422)
        ->assertJsonPath('data.needs_review.0.issue', 'wrongly_passed');

    expect($proposal->fresh()->status)->toBe('funded');
});

test('applying is a no-op when the recorded decision already matches', function () {
    $proposal = arc_defenceDecided($this->central, 'accepted', 70, 15, 'pass_defence', 'accepted');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate/apply")
        ->assertOk()
        ->assertJsonPath('message', 'The recorded decision already matches the current thresholds — nothing to correct.');

    expect($proposal->fresh()->status)->toBe('accepted');
});

test('a college officer can preview but not apply a correction', function () {
    $proposal = arc_defenceDecided($this->central, 'accepted', 50, 10, 'pass_defence', 'accepted');
    $collegeOfficer = User::factory()->create(['college_id' => $proposal->college_id]);
    $collegeOfficer->assignRole('college_officer');

    $this->actingAs($collegeOfficer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate")
        ->assertOk()
        ->assertJsonPath('data.can_apply_corrections', false);

    $this->actingAs($collegeOfficer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate/apply")
        ->assertForbidden();

    expect($proposal->fresh()->status)->toBe('accepted');
});

test('a phase score never exceeds that phase\'s maximum, even when a question max was lowered after scoring', function () {
    $proposal = arc_makeProposal($this->central, 'blind_review_passed');
    arc_score($proposal, $this->central, 'blind_review', 80, 80); // full marks
    EvaluationQuestion::whereHas('category.evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
        ->update(['max_score' => 50]); // max lowered after scoring — stored 80 now exceeds it

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate?phase=blind_review")
        ->assertOk()
        ->assertJsonPath('data.blind.score', 80)
        ->assertJsonPath('data.blind.max', 80);
});

test('recalculating one phase only reports that phase\'s corrections', function () {
    // Blind wrongly passed (30/80 < 40) AND defence wrongly accepted (40/100 < 70).
    $proposal = arc_defenceDecided($this->central, 'accepted', 30, 10, 'pass_defence', 'accepted');

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate?phase=blind_review")
        ->assertJsonPath('data.phase', 'blind_review')
        ->assertJsonCount(1, 'data.corrections')
        ->assertJsonPath('data.corrections.0.phase', 'blind_review');

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate?phase=open_defence")
        ->assertJsonCount(1, 'data.corrections')
        ->assertJsonPath('data.corrections.0.phase', 'open_defence');
});

test('applying the open defence recalculation leaves the blind review decision alone', function () {
    $proposal = arc_defenceDecided($this->central, 'accepted', 30, 10, 'pass_defence', 'accepted');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate/apply", ['phase' => 'open_defence'])
        ->assertOk()
        ->assertJsonCount(1, 'data.corrected');

    expect($proposal->fresh()->status)->toBe('rejected')
        ->and(DB::table('workflow_logs')->where('proposal_id', $proposal->id)->where('action', 'fail_blind_review')->exists())->toBeFalse();
});

test('an unknown phase is rejected', function () {
    $proposal = arc_makeProposal($this->central, 'accepted');

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate?phase=central")
        ->assertUnprocessable();
});

test('the accepted status is labelled Central Evaluation', function () {
    expect(Proposal::statusLabel('accepted'))->toBe('Central Evaluation')
        ->and(Proposal::statusLabel('under_open_defence'))->toBe('Under Open Defence');
});
