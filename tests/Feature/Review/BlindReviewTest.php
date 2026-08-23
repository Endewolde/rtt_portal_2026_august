<?php

use App\Exceptions\ConflictingReviewerException;
use App\Exceptions\InvalidScoreException;
use App\Exceptions\ReviewAlreadySubmittedException;
use App\Exceptions\ReviewerOverloadedException;
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
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();

    $this->assignmentService = app(ReviewAssignmentService::class);
    $this->scoreService = app(ReviewScoreService::class);

    $this->centralUser = User::factory()->create();
    $this->centralUser->assignRole('central_officer');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProposalInState(string $status = 'validated', string $category = 'research'): array
{
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10000, 99999)]);

    $adminUser = User::factory()->create();
    $adminUser->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'Call '.rand(), 'slug' => 'c-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $adminUser->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'Test Proposal', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026',
        'created_by' => $pi->id,
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
        'name' => 'blind_review_test_'.rand(100, 999),
        'label' => 'Blind Review Test',
        'proposal_category' => 'research',
        'is_active' => true,
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
            'question_text' => 'Q'.($i + 1),
            'max_score' => $maxScore,
            'weight' => 1.00,
            'is_required' => true,
            'order_index' => $i + 1,
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
            'question_text' => "Q{$i}",
            'max_score' => $maxScore,
            'weight' => 1.00,
            'is_required' => true,
            'order_index' => $i + 1,
        ]);
    }

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by' => $assignedBy->id,
        'status' => 'submitted',
        'assigned_at' => now(),
        'submitted_at' => now(),
    ]);

    foreach ($questions as $q) {
        ReviewScore::create([
            'review_assignment_id' => $assignment->id,
            'evaluation_question_id' => $q->id,
            'score' => $score,
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

test('the assignment notification is labeled Blind Review, not Open Defence', function () {
    // Regression: WorkflowService::transition() refreshes the passed-in $proposal
    // in place (validated -> under_blind_review) *inside* assign()'s own DB
    // transaction, so reading $proposal->status again afterwards to decide the
    // notification's review type always looked like "not validated" and mislabeled
    // every blind review assignment as "Open Defence".
    [$proposal] = makeProposalInState('validated');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = makeBlindType();

    $this->assignmentService->assign($proposal, [$reviewer->id], $type->id, $this->centralUser);

    $notification = DB::table('notifications')
        ->where('notifiable_id', $reviewer->id)
        ->where('type', 'review_assignment')
        ->latest('created_at')
        ->first();

    expect($notification)->not->toBeNull();
    expect(json_decode($notification->data, true)['review_type'])->toBe('Blind Review');
});

test('score exceeding max_score throws InvalidScoreException', function () {
    [$proposal] = makeProposalInState('validated');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = makeBlindType();
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
    $type = makeBlindType();
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
    $type = makeBlindType();
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
    $type = makeBlindType();
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
    $type = makeBlindType();
    $questions = makeQuestions($type, 4, 5);

    $assignments = $this->assignmentService->assign($proposal, [$reviewer->id], $type->id, $this->centralUser);

    // 2/5 = 40% → fails
    $answers = array_map(fn ($q) => ['question_id' => $q->id, 'score' => 2], $questions);
    $this->scoreService->submitScore($assignments[0], $answers, $reviewer);

    expect(Proposal::find($proposal->id)->status)->toBe('rejected');
});

test('review-management list is scoped to the officer\'s category', function () {
    [$researchProposal] = makeProposalInState('validated', 'research');
    [$communityProposal] = makeProposalInState('validated', 'community_engagement');

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')
        ->getJson('/api/v1/admin/review-management?status=validated');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($researchProposal->id);
    expect($ids)->not->toContain($communityProposal->id);
});

test('review-management list is unscoped for central officers across categories', function () {
    [$researchProposal] = makeProposalInState('validated', 'research');
    [$communityProposal] = makeProposalInState('validated', 'community_engagement');

    $response = $this->actingAs($this->centralUser, 'sanctum')
        ->getJson('/api/v1/admin/review-management?status=validated');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($researchProposal->id);
    expect($ids)->toContain($communityProposal->id);
});

test('available reviewers include both staff and external_reviewer, but not other roles', function () {
    [$proposal] = makeProposalInState('validated');

    $staffReviewer = User::factory()->create();
    $staffReviewer->assignRole('staff');

    $externalReviewer = User::factory()->create();
    $externalReviewer->assignRole('external_reviewer');

    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $available = $this->assignmentService->getAvailableReviewers($proposal->id);
    $ids = $available->pluck('id');

    expect($ids)->toContain($staffReviewer->id)
        ->toContain($externalReviewer->id)
        ->not->toContain($pi->id);
});

test('available reviewers can be narrowed to internal or external via reviewer_type filter', function () {
    [$proposal] = makeProposalInState('validated');

    $staffReviewer = User::factory()->create();
    $staffReviewer->assignRole('staff');

    $externalReviewer = User::factory()->create();
    $externalReviewer->assignRole('external_reviewer');

    $internalOnly = $this->assignmentService->getAvailableReviewers($proposal->id, ['reviewer_type' => 'internal']);
    expect($internalOnly->pluck('id'))->toContain($staffReviewer->id)
        ->not->toContain($externalReviewer->id);

    $externalOnly = $this->assignmentService->getAvailableReviewers($proposal->id, ['reviewer_type' => 'external']);
    expect($externalOnly->pluck('id'))->toContain($externalReviewer->id)
        ->not->toContain($staffReviewer->id);
});

test('external_reviewer role is scoped to reviewing only — no proposal creation or admin permissions', function () {
    $externalReviewer = User::factory()->create();
    $externalReviewer->assignRole('external_reviewer');

    expect($externalReviewer->hasPermissionTo('review_assignments.view_any'))->toBeTrue()
        ->and($externalReviewer->hasPermissionTo('reviews.create'))->toBeTrue()
        ->and($externalReviewer->hasPermissionTo('proposals.create'))->toBeFalse()
        ->and($externalReviewer->hasPermissionTo('proposals.view_any'))->toBeFalse()
        ->and($externalReviewer->hasPermissionTo('users.view_any'))->toBeFalse();
});

// ─── Workload cap ────────────────────────────────────────────────────────────

test('assign throws ReviewerOverloadedException once a reviewer hits the max active workload', function () {
    $type = makeBlindType();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');

    // Default cap seeded by ThresholdSettingSeeder is 5.
    for ($i = 0; $i < 5; $i++) {
        [$otherProposal] = makeProposalInState('validated');
        $this->assignmentService->assign($otherProposal, [$reviewer->id], $type->id, $this->centralUser);
    }

    [$targetProposal] = makeProposalInState('validated');

    expect(fn () => $this->assignmentService->assign($targetProposal, [$reviewer->id], $type->id, $this->centralUser))
        ->toThrow(ReviewerOverloadedException::class);
});

test('assign succeeds past the workload cap when explicitly overridden', function () {
    $type = makeBlindType();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');

    for ($i = 0; $i < 5; $i++) {
        [$otherProposal] = makeProposalInState('validated');
        $this->assignmentService->assign($otherProposal, [$reviewer->id], $type->id, $this->centralUser);
    }

    [$targetProposal] = makeProposalInState('validated');

    $assignments = $this->assignmentService->assign(
        $targetProposal, [$reviewer->id], $type->id, $this->centralUser, [], null, true
    );

    expect($assignments)->toHaveCount(1);
});

test('reviewer just under the cap can still be assigned', function () {
    $type = makeBlindType();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');

    for ($i = 0; $i < 4; $i++) {
        [$otherProposal] = makeProposalInState('validated');
        $this->assignmentService->assign($otherProposal, [$reviewer->id], $type->id, $this->centralUser);
    }

    [$targetProposal] = makeProposalInState('validated');

    $assignments = $this->assignmentService->assign($targetProposal, [$reviewer->id], $type->id, $this->centralUser);

    expect($assignments)->toHaveCount(1);
});

test('add-reviewer endpoint rejects an overloaded reviewer with 422, then succeeds with override', function () {
    $type = makeBlindType();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');

    for ($i = 0; $i < 5; $i++) {
        [$otherProposal] = makeProposalInState('validated');
        $this->assignmentService->assign($otherProposal, [$reviewer->id], $type->id, $this->centralUser);
    }

    [$targetProposal] = makeProposalInState('under_blind_review');
    $existingReviewer = User::factory()->create();
    $existingReviewer->assignRole('staff');
    ReviewAssignment::create([
        'proposal_id' => $targetProposal->id,
        'reviewer_id' => $existingReviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by' => $this->centralUser->id,
        'status' => 'pending',
        'assigned_at' => now(),
        'due_date' => now()->addDays(7)->toDateString(),
    ]);

    $blocked = $this->actingAs($this->centralUser, 'sanctum')
        ->postJson("/api/v1/proposals/{$targetProposal->id}/review/add-reviewer", [
            'reviewer_id' => $reviewer->id,
            'due_date' => now()->addDays(7)->toDateString(),
        ]);
    $blocked->assertStatus(422);
    expect($blocked->json('message'))->toContain('max workload');

    $allowed = $this->actingAs($this->centralUser, 'sanctum')
        ->postJson("/api/v1/proposals/{$targetProposal->id}/review/add-reviewer", [
            'reviewer_id' => $reviewer->id,
            'due_date' => now()->addDays(7)->toDateString(),
            'override_workload_cap' => true,
        ]);
    $allowed->assertCreated();
});

test('assigning a conflicting reviewer via HTTP returns a clean 422, not a raw 500', function () {
    // Regression: ConflictingReviewerException extends RuntimeException, which had no
    // matching $exceptions->render() mapping in bootstrap/app.php (unlike its sibling
    // ReviewerOverloadedException, which extends InvalidArgumentException and IS mapped).
    // In production (APP_DEBUG=false) this fell through to a raw, unhelpful 500 the
    // moment an admin's reviewer selection included a co-investigator or the PI —
    // easy to hit once 3+ reviewers are being picked at once.
    [$proposal, $pi] = makeProposalInState('validated');
    $co = User::factory()->create();
    $co->assignRole('reviewer');
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $co->id,
        'role' => 'co_investigator', 'status' => 'active', 'joined_at' => now(),
    ]);
    $validReviewer = User::factory()->create();
    $validReviewer->assignRole('reviewer');
    $type = makeBlindType();

    $response = $this->actingAs($this->centralUser, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/review/assign", [
            'reviewer_ids' => [$validReviewer->id, $co->id],
            'evaluation_type_id' => $type->id,
            'due_date' => now()->addDays(7)->toDateString(),
        ]);

    $response->assertStatus(422);
    expect($response->json('message'))->toContain('cannot review this proposal');
    expect(Proposal::find($proposal->id)->status)->toBe('validated');
});
