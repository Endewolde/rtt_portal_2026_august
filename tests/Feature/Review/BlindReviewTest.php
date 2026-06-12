<?php

use App\Exceptions\ConflictingReviewerException;
use App\Exceptions\InvalidScoreException;
use App\Exceptions\ReviewAlreadySubmittedException;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use App\Services\ReviewAssignmentService;
use App\Services\ReviewScoreService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();

    $this->assignmentService = app(ReviewAssignmentService::class);
    $this->scoreService      = app(ReviewScoreService::class);

    $this->centralUser = User::factory()->create();
    $this->centralUser->assignRole('central_officer');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProposalInState(string $status = 'validated'): array
{
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);

    $adminUser = User::factory()->create();
    $adminUser->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title'         => 'Call '.rand(), 'slug' => 'c-'.rand(10000, 99999),
        'start_date'    => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $adminUser->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Test Proposal', 'status' => $status,
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026',
        'created_by'       => $pi->id,
    ]);

    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $pi->id,
        'role' => 'pi', 'status' => 'active', 'joined_at' => now(),
    ]);

    return [$proposal, $pi];
}

function makeBlindType(): EvaluationType
{
    return EvaluationType::create([
        'name'              => 'blind_review_test_'.rand(100, 999),
        'label'             => 'Blind Review Test',
        'proposal_category' => 'research',
        'is_active'         => true,
    ]);
}

function makeQuestions(EvaluationType $type, int $count = 4, int $maxScore = 5): array
{
    $cat = EvaluationCategory::create([
        'evaluation_type_id' => $type->id, 'name' => 'Category',
        'order_index' => 1, 'weight' => 100,
    ]);

    $questions = [];
    for ($i = 0; $i < $count; $i++) {
        $questions[] = EvaluationQuestion::create([
            'evaluation_category_id' => $cat->id,
            'question_text'          => "Q".($i + 1),
            'max_score'              => $maxScore,
            'weight'                 => 1.00,
            'is_required'            => true,
            'order_index'            => $i + 1,
        ]);
    }

    return $questions;
}

function makeAssignmentWithScores(Proposal $proposal, EvaluationType $type, User $assignedBy, int $score, int $maxScore = 5, int $questionCount = 4): ReviewAssignment
{
    $cat = EvaluationCategory::create([
        'evaluation_type_id' => $type->id, 'name' => 'Cat'.rand(),
        'order_index' => 1, 'weight' => 100,
    ]);

    $questions = [];
    for ($i = 0; $i < $questionCount; $i++) {
        $questions[] = EvaluationQuestion::create([
            'evaluation_category_id' => $cat->id,
            'question_text'          => "Q{$i}",
            'max_score'              => $maxScore,
            'weight'                 => 1.00,
            'is_required'            => true,
            'order_index'            => $i + 1,
        ]);
    }

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $assignment = ReviewAssignment::create([
        'proposal_id'        => $proposal->id,
        'reviewer_id'        => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by'        => $assignedBy->id,
        'status'             => 'submitted',
        'assigned_at'        => now(),
        'submitted_at'       => now(),
    ]);

    foreach ($questions as $q) {
        ReviewScore::create([
            'review_assignment_id'   => $assignment->id,
            'evaluation_question_id' => $q->id,
            'score'                  => $score,
        ]);
    }

    return $assignment;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('PI cannot be assigned as reviewer to own proposal', function () {
    [$proposal, $pi] = makeProposalInState('validated');
    $type = makeBlindType();

    expect(fn () => $this->assignmentService->assign($proposal, [$pi->id], $type->id, $this->centralUser))
        ->toThrow(ConflictingReviewerException::class);
});

test('co-investigator cannot be assigned as reviewer', function () {
    [$proposal, $pi] = makeProposalInState('validated');
    $co = User::factory()->create();
    $co->assignRole('reviewer');
    $type = makeBlindType();

    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $co->id,
        'role' => 'co_investigator', 'status' => 'active', 'joined_at' => now(),
    ]);

    expect(fn () => $this->assignmentService->assign($proposal, [$co->id], $type->id, $this->centralUser))
        ->toThrow(ConflictingReviewerException::class);
});

test('valid reviewer can be assigned and proposal moves to under_blind_review', function () {
    [$proposal] = makeProposalInState('validated');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = makeBlindType();

    $assignments = $this->assignmentService->assign($proposal, [$reviewer->id], $type->id, $this->centralUser);

    expect($assignments)->toHaveCount(1)
        ->and(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('score exceeding max_score throws InvalidScoreException', function () {
    [$proposal] = makeProposalInState('validated');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type      = makeBlindType();
    $questions = makeQuestions($type, 1, 5);

    $assignments = $this->assignmentService->assign($proposal, [$reviewer->id], $type->id, $this->centralUser);

    expect(fn () => $this->scoreService->submitScore($assignments[0], [
        ['question_id' => $questions[0]->id, 'score' => 6],
    ], $reviewer))->toThrow(InvalidScoreException::class);
});

test('already submitted review throws ReviewAlreadySubmittedException', function () {
    [$proposal] = makeProposalInState('validated');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type      = makeBlindType();
    $questions = makeQuestions($type, 1, 5);

    $assignments = $this->assignmentService->assign($proposal, [$reviewer->id], $type->id, $this->centralUser);
    $answers = [['question_id' => $questions[0]->id, 'score' => 3]];

    $this->scoreService->submitScore($assignments[0], $answers, $reviewer);

    expect(fn () => $this->scoreService->submitScore($assignments[0]->fresh(), $answers, $reviewer))
        ->toThrow(ReviewAlreadySubmittedException::class);
});

test('scoring formula: score of 3 on all 5-max questions = 60%', function () {
    [$proposal] = makeProposalInState('under_blind_review');
    $type = makeBlindType();

    $assignment = makeAssignmentWithScores($proposal, $type, $this->centralUser, 3, 5, 4);

    expect($this->scoreService->calculateScore($assignment))->toBe(60.0);
});

test('scoring formula: score of 5 on all 5-max questions = 100%', function () {
    [$proposal] = makeProposalInState('under_blind_review');
    $type = makeBlindType();

    $assignment = makeAssignmentWithScores($proposal, $type, $this->centralUser, 5, 5, 4);

    expect($this->scoreService->calculateScore($assignment))->toBe(100.0);
});

test('scoring formula: score of 0 on all questions = 0%', function () {
    [$proposal] = makeProposalInState('under_blind_review');
    $type = makeBlindType();

    $assignment = makeAssignmentWithScores($proposal, $type, $this->centralUser, 0, 5, 4);

    expect($this->scoreService->calculateScore($assignment))->toBe(0.0);
});

test('all reviewers must submit before result is processed', function () {
    [$proposal] = makeProposalInState('validated');
    $r1 = User::factory()->create();
    $r1->assignRole('reviewer');
    $r2 = User::factory()->create();
    $r2->assignRole('reviewer');
    $type      = makeBlindType();
    $questions = makeQuestions($type, 2, 5);

    $assignments = $this->assignmentService->assign($proposal, [$r1->id, $r2->id], $type->id, $this->centralUser);

    $answers = [
        ['question_id' => $questions[0]->id, 'score' => 5],
        ['question_id' => $questions[1]->id, 'score' => 5],
    ];
    $this->scoreService->submitScore($assignments[0], $answers, $r1);

    // r2 hasn't submitted → should still be under_blind_review
    expect(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('proposal passes to blind_review_passed when average >= 60', function () {
    [$proposal] = makeProposalInState('validated');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type      = makeBlindType();
    $questions = makeQuestions($type, 4, 5);

    $assignments = $this->assignmentService->assign($proposal, [$reviewer->id], $type->id, $this->centralUser);

    // 3/5 = 60% → passes
    $answers = array_map(fn ($q) => ['question_id' => $q->id, 'score' => 3], $questions);
    $this->scoreService->submitScore($assignments[0], $answers, $reviewer);

    expect(Proposal::find($proposal->id)->status)->toBe('blind_review_passed');
});

test('proposal moves to rejected when average < 60', function () {
    [$proposal] = makeProposalInState('validated');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type      = makeBlindType();
    $questions = makeQuestions($type, 4, 5);

    $assignments = $this->assignmentService->assign($proposal, [$reviewer->id], $type->id, $this->centralUser);

    // 2/5 = 40% → fails
    $answers = array_map(fn ($q) => ['question_id' => $q->id, 'score' => 2], $questions);
    $this->scoreService->submitScore($assignments[0], $answers, $reviewer);

    expect(Proposal::find($proposal->id)->status)->toBe('rejected');
});
