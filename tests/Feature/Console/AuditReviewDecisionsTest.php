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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function ard_makeProposal(string $status): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'AR'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'ARD'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ar-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'AR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $central];
}

function ard_logDecision(Proposal $proposal, User $actor, string $action, string $from, string $to): void
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

test('flags a proposal that was passed under the old logic but would now fail under the raw-points threshold', function () {
    [$proposal, $central] = ard_makeProposal('blind_review_passed');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $type = EvaluationType::create(['name' => 'blind_review_ard_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $q = EvaluationQuestion::create(['evaluation_category_id' => $cat->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $central->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => 55]);

    ThresholdSetting::create(['key' => 'blind_threshold', 'value' => 60]);

    // Simulate the OLD decision: recorded as "passed" (as the pre-fix percentage-based
    // comparison would have done: 55/80 = 68.75% >= 60%), even though 55 raw points is
    // below the 60-point threshold under the corrected logic.
    ard_logDecision($proposal, $central, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $exitCode = Artisan::call('reviews:audit-decisions');
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('passed')
        ->and($output)->toContain('would fail');
});

test('reports no mismatches when every recorded decision still agrees with current thresholds', function () {
    [$proposal, $central] = ard_makeProposal('blind_review_passed');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $type = EvaluationType::create(['name' => 'blind_review_ard2_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $q = EvaluationQuestion::create(['evaluation_category_id' => $cat->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $central->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => 65]);

    ThresholdSetting::create(['key' => 'blind_threshold', 'value' => 60]);
    ard_logDecision($proposal, $central, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');

    $exitCode = Artisan::call('reviews:audit-decisions');
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain('No mismatches found');
});
