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
use App\Services\ReviewScoreService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAssignmentWithScores(int $score, int $maxScore = 5, int $qCount = 4): ReviewAssignment
{
    $user  = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_office');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call    = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'C', 'slug' => 's-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'T-'.rand(10000, 99999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $user->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $user->id,
    ]);

    $type = EvaluationType::create([
        'name' => 'blind_review_test_'.rand(100, 999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $cat = EvaluationCategory::create([
        'evaluation_type_id' => $type->id, 'name' => 'Cat',
        'order_index' => 1, 'weight' => 100,
    ]);

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $assignment = ReviewAssignment::create([
        'proposal_id'        => $proposal->id,
        'reviewer_id'        => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by'        => $admin->id,
        'status'             => 'submitted',
        'assigned_at'        => now(),
        'submitted_at'       => now(),
    ]);

    for ($i = 0; $i < $qCount; $i++) {
        $q = EvaluationQuestion::create([
            'evaluation_category_id' => $cat->id,
            'question_text'          => "Q{$i}",
            'max_score'              => $maxScore,
            'weight'                 => 1.00,
            'is_required'            => true,
            'order_index'            => $i + 1,
        ]);

        ReviewScore::create([
            'review_assignment_id'   => $assignment->id,
            'evaluation_question_id' => $q->id,
            'score'                  => $score,
        ]);
    }

    return $assignment;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('calculateScore returns 60.0 when all scores are 3 of max 5', function () {
    $assignment = buildAssignmentWithScores(3, 5, 4);

    expect(app(ReviewScoreService::class)->calculateScore($assignment))->toBe(60.0);
});

test('calculateScore returns 100.0 when all scores equal max_score', function () {
    $assignment = buildAssignmentWithScores(5, 5, 4);

    expect(app(ReviewScoreService::class)->calculateScore($assignment))->toBe(100.0);
});

test('calculateScore returns 0.0 when all scores are 0', function () {
    $assignment = buildAssignmentWithScores(0, 5, 4);

    expect(app(ReviewScoreService::class)->calculateScore($assignment))->toBe(0.0);
});

test('calculateScore returns 0.0 for assignment with no scores', function () {
    $user    = User::factory()->create();
    $admin   = User::factory()->create();
    $admin->assignRole('central_office');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call    = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'C', 'slug' => 's-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'T-'.rand(10000, 99999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $user->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $user->id,
    ]);

    $type = EvaluationType::create([
        'name' => 'blind_review_test_'.rand(100, 999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $emptyAssignment = ReviewAssignment::create([
        'proposal_id'        => $proposal->id,
        'reviewer_id'        => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by'        => $admin->id,
        'status'             => 'submitted',
        'assigned_at'        => now(),
    ]);

    expect(app(ReviewScoreService::class)->calculateScore($emptyAssignment))->toBe(0.0);
});

test('processBlindReviewResult does nothing if not all reviewers submitted', function () {
    $user    = User::factory()->create();
    $admin   = User::factory()->create();
    $admin->assignRole('central_office');
    $r1      = User::factory()->create();
    $r1->assignRole('reviewer');
    $r2      = User::factory()->create();
    $r2->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call    = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'C', 'slug' => 's-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'T-'.rand(10000, 99999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $user->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $user->id,
    ]);

    $type = EvaluationType::create([
        'name' => 'blind_review_test_'.rand(100, 999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $r1->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $admin->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);

    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $r2->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $admin->id,
        'status' => 'pending', // not submitted
        'assigned_at' => now(),
    ]);

    app(ReviewScoreService::class)->processBlindReviewResult($proposal);

    // Status must NOT change — r2 hasn't submitted
    expect(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('processBlindReviewResult passes proposal when average >= threshold', function () {
    $assignment = buildAssignmentWithScores(3, 5, 4); // 60%
    $proposal   = $assignment->proposal;

    app(ReviewScoreService::class)->processBlindReviewResult($proposal);

    expect(Proposal::find($proposal->id)->status)->toBe('blind_review_passed');
});

test('processBlindReviewResult rejects proposal when average < threshold', function () {
    $assignment = buildAssignmentWithScores(2, 5, 4); // 40%
    $proposal   = $assignment->proposal;

    app(ReviewScoreService::class)->processBlindReviewResult($proposal);

    expect(Proposal::find($proposal->id)->status)->toBe('rejected');
});
