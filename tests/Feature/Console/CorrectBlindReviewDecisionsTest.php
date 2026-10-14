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
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function cbr_makeProposal(string $status): array
{
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'CB'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CBD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'cb-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'CB-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $superAdmin];
}

function cbr_scoreBlindReview(Proposal $proposal, User $actor, int $score): void
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $type = EvaluationType::create(['name' => 'blind_review_cbr_'.Str::random(6), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $q = EvaluationQuestion::create(['evaluation_category_id' => $cat->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $actor->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => $score]);
}

function cbr_logDecision(Proposal $proposal, User $actor, string $action, string $from, string $to): void
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

test('dry run reports a wrongly-passed proposal but does not change its status', function () {
    [$proposal, $actor] = cbr_makeProposal('blind_review_passed');
    cbr_scoreBlindReview($proposal, $actor, 55); // 55/80, below default blind_threshold of 60
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    cbr_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $exitCode = Artisan::call('reviews:correct-blind-review');
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('DRY RUN')
        ->and(Proposal::find($proposal->id)->status)->toBe('blind_review_passed');
});

test('--force corrects a wrongly-passed proposal still awaiting defence scheduling', function () {
    [$proposal, $actor] = cbr_makeProposal('blind_review_passed');
    cbr_scoreBlindReview($proposal, $actor, 55);
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    cbr_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $exitCode = Artisan::call('reviews:correct-blind-review', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('corrected')
        ->and(Proposal::find($proposal->id)->status)->toBe('rejected');

    $log = DB::table('workflow_logs')
        ->where('proposal_id', $proposal->id)
        ->where('action', 'fail_blind_review')
        ->where('from_stage', 'blind_review_passed')
        ->first();
    expect($log)->not->toBeNull();
    expect(json_decode($log->metadata, true)['corrected'])->toBeTrue();
});

test('--force does NOT touch a wrongly-passed proposal that already progressed to open defence', function () {
    [$proposal, $actor] = cbr_makeProposal('under_open_defence');
    cbr_scoreBlindReview($proposal, $actor, 55);
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    cbr_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $exitCode = Artisan::call('reviews:correct-blind-review', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('manual review')
        ->and(Proposal::find($proposal->id)->status)->toBe('under_open_defence');
});

test('a wrongly-rejected proposal is reported but never auto-reopened (terminal stage)', function () {
    [$proposal, $actor] = cbr_makeProposal('rejected');
    cbr_scoreBlindReview($proposal, $actor, 70); // 70/80, above threshold — should have passed
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    cbr_logDecision($proposal, $actor, 'fail_blind_review', 'under_blind_review', 'rejected');

    $exitCode = Artisan::call('reviews:correct-blind-review', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('terminal stage')
        ->and(Proposal::find($proposal->id)->status)->toBe('rejected');
});

test('reports nothing to do when every decision already matches current thresholds', function () {
    [$proposal, $actor] = cbr_makeProposal('blind_review_passed');
    cbr_scoreBlindReview($proposal, $actor, 70);
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    cbr_logDecision($proposal, $actor, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $exitCode = Artisan::call('reviews:correct-blind-review', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain('nothing to do');
});
