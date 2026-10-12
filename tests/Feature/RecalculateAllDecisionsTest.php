<?php

use App\Jobs\SendEmailNotificationJob;
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
use App\Services\ReviewScoreService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    ThresholdSetting::updateOrCreate(['key' => 'defence_threshold'], ['value' => 10]);
    ThresholdSetting::updateOrCreate(['key' => 'combined_threshold'], ['value' => 70]);
});

function rad_makeProposal(string $status): array
{
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'RD'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RDD'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'rd-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'RD-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $superAdmin];
}

function rad_score(Proposal $proposal, User $actor, string $namePrefix, int $max, int $score): void
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $type = EvaluationType::create(['name' => $namePrefix.'_'.Str::random(6), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => $max]);
    $q = EvaluationQuestion::create(['evaluation_category_id' => $cat->id, 'question_text' => 'Q', 'max_score' => $max, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $actor->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => $score]);
}

function rad_logDecision(Proposal $proposal, User $actor, string $action, string $from, string $to): void
{
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(),
        'proposal_id' => $proposal->id,
        'from_stage' => $from,
        'action' => $action,
        'to_stage' => $to,
        'actor_id' => $actor->id,
        'notes' => null,
        'metadata' => null,
        'created_at' => now(),
    ]);
}

// ─── Blind review ───────────────────────────────────────────────────────────────

test('a wrongly-passed proposal still sitting at blind_review_passed is auto-corrected', function () {
    [$proposal, $actor] = rad_makeProposal('blind_review_passed');
    rad_score($proposal, $actor, 'blind_review', 80, 55); // below threshold 60
    rad_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $result = app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    expect($result['corrected'])->toHaveCount(1)
        ->and($result['needs_review'])->toBeEmpty()
        ->and($proposal->fresh()->status)->toBe('rejected');
});

test('a wrongly-passed proposal that already progressed is left alone and flagged', function () {
    [$proposal, $actor] = rad_makeProposal('under_open_defence');
    rad_score($proposal, $actor, 'blind_review', 80, 55);
    rad_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $result = app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    expect($result['corrected'])->toBeEmpty()
        ->and($result['needs_review'])->toHaveCount(1)
        ->and($result['needs_review'][0]['issue'])->toBe('wrongly_passed')
        ->and($proposal->fresh()->status)->toBe('under_open_defence');
});

test('a wrongly-rejected proposal (blind review) is auto-corrected to blind_review_passed', function () {
    [$proposal, $actor] = rad_makeProposal('rejected');
    rad_score($proposal, $actor, 'blind_review', 80, 70); // above threshold — should have passed
    rad_logDecision($proposal, $actor, 'fail_blind_review', 'under_blind_review', 'rejected');

    $result = app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    expect($result['needs_review'])->toBeEmpty()
        ->and($result['corrected'])->toHaveCount(1)
        ->and($result['corrected'][0]['change'])->toBe('rejected → blind_review_passed')
        ->and($proposal->fresh()->status)->toBe('blind_review_passed');

    $logs = DB::table('workflow_logs')->where('proposal_id', $proposal->id)->orderBy('created_at')->pluck('to_stage', 'action');
    expect($logs->get('reopen'))->toBe('under_blind_review')
        ->and($logs->get('pass_blind_review'))->toBe('blind_review_passed');
});

// ─── Open defence ────────────────────────────────────────────────────────────────

test('a wrongly-accepted proposal still sitting at accepted is auto-corrected to rejected', function () {
    [$proposal, $actor] = rad_makeProposal('accepted');
    rad_score($proposal, $actor, 'blind_review', 80, 64);
    rad_score($proposal, $actor, 'open_defence', 20, 4); // combined 68/100, below threshold 70
    rad_logDecision($proposal, $actor, 'pass_defence', 'under_open_defence', 'accepted');

    $result = app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    expect($result['corrected'])->toHaveCount(1)
        ->and($proposal->fresh()->status)->toBe('rejected');
});

test('a wrongly-rejected proposal (defence) is auto-corrected to accepted', function () {
    [$proposal, $actor] = rad_makeProposal('rejected');
    rad_score($proposal, $actor, 'blind_review', 80, 64);
    rad_score($proposal, $actor, 'open_defence', 20, 10); // combined 74/100, above threshold 70
    rad_logDecision($proposal, $actor, 'fail_defence', 'under_open_defence', 'rejected');

    $result = app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    expect($result['needs_review'])->toBeEmpty()
        ->and($result['corrected'])->toHaveCount(1)
        ->and($result['corrected'][0]['change'])->toBe('rejected → accepted')
        ->and($proposal->fresh()->status)->toBe('accepted');
});

test('the PI is not sent a duplicate "reopened" notice when a rejection is auto-corrected to a pass', function () {
    [$proposal, $actor] = rad_makeProposal('rejected');
    rad_score($proposal, $actor, 'blind_review', 80, 70);
    rad_logDecision($proposal, $actor, 'fail_blind_review', 'under_blind_review', 'rejected');
    $pi = User::find($proposal->pi_user_id);

    Queue::fake();
    app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    Queue::assertNotPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id && ($job->data['decision'] ?? null) === 'reopened');
});

test('a funded proposal is never touched even if its original decision would now fail', function () {
    [$proposal, $actor] = rad_makeProposal('funded');
    rad_score($proposal, $actor, 'blind_review', 80, 55);
    rad_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $result = app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    expect($result['corrected'])->toBeEmpty();
    $flagged = collect($result['needs_review'])->firstWhere('proposal_id', $proposal->id);
    expect($flagged)->not->toBeNull()
        ->and($proposal->fresh()->status)->toBe('funded');
});

test('nothing changes when every decision already matches current thresholds', function () {
    [$proposal, $actor] = rad_makeProposal('blind_review_passed');
    rad_score($proposal, $actor, 'blind_review', 80, 70);
    rad_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $result = app(ReviewScoreService::class)->recalculateAllDecisions($actor);

    expect($result['corrected'])->toBeEmpty()
        ->and($result['needs_review'])->toBeEmpty()
        ->and($proposal->fresh()->status)->toBe('blind_review_passed');
});

// ─── Automatic trigger from SettingsController ──────────────────────────────────

test('saving a threshold via the legacy settings endpoint triggers recalculation', function () {
    [$proposal, $actor] = rad_makeProposal('blind_review_passed');
    rad_score($proposal, $actor, 'blind_review', 80, 65); // passes at 60, would fail at 70
    rad_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings', ['blind_threshold' => 70]);

    $response->assertOk();
    expect($response->json('meta.decisions_corrected'))->toHaveCount(1)
        ->and($proposal->fresh()->status)->toBe('rejected');
});

test('saving an unrelated setting does not trigger recalculation', function () {
    [$proposal, $actor] = rad_makeProposal('blind_review_passed');
    rad_score($proposal, $actor, 'blind_review', 80, 55);
    rad_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings', ['similarity_threshold' => 0.5]);

    $response->assertOk();
    expect($response->json('meta.decisions_corrected'))->toBeEmpty()
        ->and($proposal->fresh()->status)->toBe('blind_review_passed');
});

test('changing combined_decision_mode via updateAppSetting triggers recalculation', function () {
    [$proposal, $actor] = rad_makeProposal('accepted');
    rad_score($proposal, $actor, 'blind_review', 80, 64);
    rad_score($proposal, $actor, 'open_defence', 20, 4); // defence fails its own threshold (10)
    rad_logDecision($proposal, $actor, 'pass_defence', 'under_open_defence', 'accepted');

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    // Switching to strict_all means the defence score must ALSO individually clear its
    // own threshold — 4 < 10, so this proposal should now fail even though combined
    // (68) is under the 70 combined_threshold either way.
    $response = $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/combined_decision_mode', ['value' => 'strict_all']);

    $response->assertOk();
    expect($response->json('meta.decisions_corrected'))->toHaveCount(1)
        ->and($proposal->fresh()->status)->toBe('rejected');
});
