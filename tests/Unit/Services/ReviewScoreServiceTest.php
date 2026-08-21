<?php

use App\Exceptions\InvalidScoreException;
use App\Models\AppSetting;
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
use Illuminate\Support\Facades\DB;
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
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
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
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by' => $admin->id,
        'status' => 'submitted',
        'assigned_at' => now(),
        'submitted_at' => now(),
    ]);

    for ($i = 0; $i < $qCount; $i++) {
        $q = EvaluationQuestion::create([
            'evaluation_category_id' => $cat->id,
            'question_text' => "Q{$i}",
            'max_score' => $maxScore,
            'weight' => 1.00,
            'is_required' => true,
            'order_index' => $i + 1,
        ]);

        ReviewScore::create([
            'review_assignment_id' => $assignment->id,
            'evaluation_question_id' => $q->id,
            'score' => $score,
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
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
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
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by' => $admin->id,
        'status' => 'submitted',
        'assigned_at' => now(),
    ]);

    expect(app(ReviewScoreService::class)->calculateScore($emptyAssignment))->toBe(0.0);
});

test('processBlindReviewResult does nothing if not all reviewers submitted', function () {
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $r1 = User::factory()->create();
    $r1->assignRole('reviewer');
    $r2 = User::factory()->create();
    $r2->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
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
    $proposal = $assignment->proposal;

    app(ReviewScoreService::class)->processBlindReviewResult($proposal);

    expect(Proposal::find($proposal->id)->status)->toBe('blind_review_passed');
});

test('processBlindReviewResult rejects proposal when average < threshold', function () {
    $assignment = buildAssignmentWithScores(2, 5, 4); // 40%
    $proposal = $assignment->proposal;

    app(ReviewScoreService::class)->processBlindReviewResult($proposal);

    expect(Proposal::find($proposal->id)->status)->toBe('rejected');
});

test('calculateScore counts an entirely unscored category as zero rather than excluding its weight', function () {
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
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
        'name' => 'blind_review_test_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    // Category A (weight 60) is fully scored; category B (weight 40) has no
    // ReviewScore row at all — simulating a review that skipped an entire category.
    $catA = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 60]);
    $catB = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'B', 'order_index' => 2, 'weight' => 40]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $admin->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);

    $qA = EvaluationQuestion::create([
        'evaluation_category_id' => $catA->id, 'question_text' => 'QA',
        'max_score' => 5, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);
    EvaluationQuestion::create([
        'evaluation_category_id' => $catB->id, 'question_text' => 'QB',
        'max_score' => 5, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);

    ReviewScore::create([
        'review_assignment_id' => $assignment->id,
        'evaluation_question_id' => $qA->id,
        'score' => 5,
    ]);

    // Old buggy behavior excluded category B's weight entirely, giving 100% (5/5 in
    // the only category counted). Correct: category B counts as 0/5 with its full
    // weight, so only category A's 60-weight contributes → 60%.
    expect(app(ReviewScoreService::class)->calculateScore($assignment))->toBe(60.0);

    $display = app(ReviewScoreService::class)->calculateWeightedDisplay($assignment);
    expect($display['score'])->toBe(60.0)
        ->and($display['max'])->toBe(100.0);
});

test('processBlindReviewResult compares the RAW weighted score to blind_threshold, not a normalized percentage', function () {
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
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
        'name' => 'blind_review_test_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);
    // Category weight sums to 80 (mirrors the real blind-review setup), NOT 100.
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $q = EvaluationQuestion::create([
        'evaluation_category_id' => $cat->id, 'question_text' => 'Q',
        'max_score' => 80, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $admin->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create([
        'review_assignment_id' => $assignment->id,
        'evaluation_question_id' => $q->id,
        'score' => 50, // 50/80 = 62.5% — would have PASSED the old "percentage >= 60" check
    ]);

    // blind_threshold defaults to 60 (a RAW point minimum out of 80, i.e. 75%).
    // 50 raw points must fail even though 50/80 = 62.5% would have cleared the old
    // percentage-based comparison.
    app(ReviewScoreService::class)->processBlindReviewResult($proposal);

    expect(Proposal::find($proposal->id)->status)->toBe('rejected');
});

test('processOpenDefenceResultIfComplete gates only on combined_threshold; defence_threshold is informational', function () {
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'C', 'slug' => 's-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $blindType = EvaluationType::create([
        'name' => 'blind_review_test_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);
    $blindCat = EvaluationCategory::create(['evaluation_type_id' => $blindType->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $blindQ = EvaluationQuestion::create([
        'evaluation_category_id' => $blindCat->id, 'question_text' => 'Q',
        'max_score' => 80, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);

    $defenceType = EvaluationType::create([
        'name' => 'open_defence_test_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);
    $defenceCat = EvaluationCategory::create(['evaluation_type_id' => $defenceType->id, 'name' => 'B', 'order_index' => 1, 'weight' => 20]);
    $defenceQ = EvaluationQuestion::create([
        'evaluation_category_id' => $defenceCat->id, 'question_text' => 'Q',
        'max_score' => 20, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);

    $buildProposal = function () use ($call, $college, $dept, $user) {
        return Proposal::create([
            'tracker_number' => 'T-'.rand(100000, 999999),
            'proposal_call_id' => $call->id, 'category' => 'research',
            'title' => 'P', 'status' => 'under_open_defence',
            'pi_user_id' => $user->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $user->id,
        ]);
    };

    $score = function (Proposal $proposal, int $blindScore, int $defenceScore) use ($blindType, $blindQ, $defenceType, $defenceQ, $admin, $reviewer) {
        $blindAssignment = ReviewAssignment::create([
            'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
            'evaluation_type_id' => $blindType->id, 'assigned_by' => $admin->id,
            'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
        ]);
        ReviewScore::create(['review_assignment_id' => $blindAssignment->id, 'evaluation_question_id' => $blindQ->id, 'score' => $blindScore]);

        $defenceAssignment = ReviewAssignment::create([
            'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
            'evaluation_type_id' => $defenceType->id, 'assigned_by' => $admin->id,
            'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
        ]);
        ReviewScore::create(['review_assignment_id' => $defenceAssignment->id, 'evaluation_question_id' => $defenceQ->id, 'score' => $defenceScore]);
    };

    // defence_threshold defaults to 10 (out of 20), combined_threshold to 70 (out of 100).

    // Case A: defence score (9) misses its own threshold, but combined (65+9=74) clears
    // 70 — combined_threshold is the sole gate, so this still ADVANCES. The shortfall is
    // only recorded as an informational flag for the central-evaluation stage.
    $proposalA = $buildProposal();
    $score($proposalA, 65, 9);
    app(ReviewScoreService::class)->processOpenDefenceResultIfComplete($proposalA);
    expect(Proposal::find($proposalA->id)->status)->toBe('accepted');

    $logA = DB::table('workflow_logs')->where('proposal_id', $proposalA->id)->where('action', 'pass_defence')->first();
    expect(json_decode($logA->metadata, true)['defence_below_threshold'])->toBeTrue();

    // Case B: defence score (12) clears its own threshold, but combined (55+12=67)
    // misses 70 — fails purely on the combined gate.
    $proposalB = $buildProposal();
    $score($proposalB, 55, 12);
    app(ReviewScoreService::class)->processOpenDefenceResultIfComplete($proposalB);
    expect(Proposal::find($proposalB->id)->status)->toBe('rejected');

    // Case C: both clear — defence (15 >= 10) and combined (60+15=75 >= 70).
    $proposalC = $buildProposal();
    $score($proposalC, 60, 15);
    app(ReviewScoreService::class)->processOpenDefenceResultIfComplete($proposalC);
    expect(Proposal::find($proposalC->id)->status)->toBe('accepted');

    $logC = DB::table('workflow_logs')->where('proposal_id', $proposalC->id)->where('action', 'pass_defence')->first();
    expect(json_decode($logC->metadata, true)['defence_below_threshold'])->toBeFalse();
});

test('combined_decision_mode=strict_all requires blind, defence, AND combined to each individually pass', function () {
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'C', 'slug' => 's-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $blindType = EvaluationType::create([
        'name' => 'blind_review_strict_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);
    $blindCat = EvaluationCategory::create(['evaluation_type_id' => $blindType->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $blindQ = EvaluationQuestion::create([
        'evaluation_category_id' => $blindCat->id, 'question_text' => 'Q',
        'max_score' => 80, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);

    $defenceType = EvaluationType::create([
        'name' => 'open_defence_strict_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);
    $defenceCat = EvaluationCategory::create(['evaluation_type_id' => $defenceType->id, 'name' => 'B', 'order_index' => 1, 'weight' => 20]);
    $defenceQ = EvaluationQuestion::create([
        'evaluation_category_id' => $defenceCat->id, 'question_text' => 'Q',
        'max_score' => 20, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);

    AppSetting::updateOrCreate(
        ['key' => 'combined_decision_mode'],
        ['value' => 'strict_all', 'type' => 'select', 'group' => 'thresholds']
    );

    $buildProposal = function () use ($call, $college, $dept, $user) {
        return Proposal::create([
            'tracker_number' => 'T-'.rand(100000, 999999),
            'proposal_call_id' => $call->id, 'category' => 'research',
            'title' => 'P', 'status' => 'under_open_defence',
            'pi_user_id' => $user->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $user->id,
        ]);
    };

    $score = function (Proposal $proposal, int $blindScore, int $defenceScore) use ($blindType, $blindQ, $defenceType, $defenceQ, $admin, $reviewer) {
        $blindAssignment = ReviewAssignment::create([
            'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
            'evaluation_type_id' => $blindType->id, 'assigned_by' => $admin->id,
            'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
        ]);
        ReviewScore::create(['review_assignment_id' => $blindAssignment->id, 'evaluation_question_id' => $blindQ->id, 'score' => $blindScore]);

        $defenceAssignment = ReviewAssignment::create([
            'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
            'evaluation_type_id' => $defenceType->id, 'assigned_by' => $admin->id,
            'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
        ]);
        ReviewScore::create(['review_assignment_id' => $defenceAssignment->id, 'evaluation_question_id' => $defenceQ->id, 'score' => $defenceScore]);
    };

    // defence_threshold defaults to 10 (out of 20), combined_threshold to 70 (out of 100).

    // Under strict_all: defence (9) misses its own threshold even though combined
    // (65+9=74) clears 70 — this must now FAIL, unlike combined_only mode where it
    // would pass (see the sibling test above using the exact same numbers).
    $proposalA = $buildProposal();
    $score($proposalA, 65, 9);
    app(ReviewScoreService::class)->processOpenDefenceResultIfComplete($proposalA);
    expect(Proposal::find($proposalA->id)->status)->toBe('rejected');

    // All three individually clear their bar — passes under both modes.
    $proposalB = $buildProposal();
    $score($proposalB, 60, 15);
    app(ReviewScoreService::class)->processOpenDefenceResultIfComplete($proposalB);
    expect(Proposal::find($proposalB->id)->status)->toBe('accepted');
});

test('submitScore rejects a submission that leaves a required question unanswered', function () {
    $user = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call = ProposalCall::create([
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
        'name' => 'blind_review_test_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 100]);

    $q1 = EvaluationQuestion::create([
        'evaluation_category_id' => $cat->id, 'question_text' => 'Q1',
        'max_score' => 5, 'weight' => 1.00, 'is_required' => true, 'order_index' => 1,
    ]);
    EvaluationQuestion::create([
        'evaluation_category_id' => $cat->id, 'question_text' => 'Q2',
        'max_score' => 5, 'weight' => 1.00, 'is_required' => true, 'order_index' => 2,
    ]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $admin->id,
        'status' => 'pending', 'assigned_at' => now(),
    ]);

    expect(fn () => app(ReviewScoreService::class)->submitScore(
        $assignment,
        [['question_id' => $q1->id, 'score' => 5]], // Q2 is required but missing
        $reviewer
    ))->toThrow(InvalidScoreException::class);

    expect($assignment->fresh()->status)->toBe('pending');
});
