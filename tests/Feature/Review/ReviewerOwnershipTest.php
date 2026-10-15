<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function ro_assignment(): array
{
    $college = College::create(['name' => 'RO College '.rand(), 'code' => 'RO'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'ROD'.rand(10000, 99999)]);
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $intruder = User::factory()->create();
    $intruder->assignRole('reviewer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ro-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $officer->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'RO-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $evalType = EvaluationType::create(['name' => 'blind_review_ro_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $evalType->id, 'name' => 'A', 'order_index' => 1, 'weight' => 100]);
    $question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => 'Q', 'max_score' => 100, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $evalType->id, 'assigned_by' => $officer->id,
        'status' => 'pending', 'assigned_at' => now(),
    ]);

    acceptReviewerAgreement($reviewer);
    acceptReviewerAgreement($intruder);

    return [$reviewer, $intruder, $assignment, $question];
}

test('a reviewer cannot submit a score for someone else\'s assignment', function () {
    [, $intruder, $assignment, $question] = ro_assignment();

    $this->actingAs($intruder, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/score", [
            'answers' => [['question_id' => $question->id, 'score' => 90]],
        ])
        ->assertStatus(403);

    expect($assignment->fresh()->status)->not->toBe('submitted');
});

test('the assigned reviewer can still submit their own score', function () {
    [$reviewer, , $assignment, $question] = ro_assignment();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/score", [
            'answers' => [['question_id' => $question->id, 'score' => 90]],
        ])
        ->assertOk();

    expect($assignment->fresh()->status)->toBe('submitted');
});
