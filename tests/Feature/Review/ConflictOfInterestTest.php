<?php

use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
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
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Bus::fake();
});

function coi_assignment(): array
{
    $college = College::create(['name' => 'COI College '.rand(), 'code' => 'COI'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'COID'.rand(10, 99)]);
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'coi-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $officer->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'COI-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $evalType = EvaluationType::create(['name' => 'blind_review_coi_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $evalType->id, 'name' => 'A', 'order_index' => 1, 'weight' => 100]);
    $question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => 'Q', 'max_score' => 100, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $evalType->id, 'assigned_by' => $officer->id,
        'status' => 'pending', 'assigned_at' => now(),
    ]);

    return [$reviewer, $officer, $assignment, $question];
}

test('a reviewer can declare no conflict', function () {
    [$reviewer, , $assignment] = coi_assignment();

    $response = $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", ['has_conflict' => false])
        ->assertOk();

    expect($response->json('data.coi_has_conflict'))->toBeFalse()
        ->and($assignment->fresh()->coi_declared_at)->not->toBeNull();

    Bus::assertNotDispatched(StoreInAppNotificationJob::class);
});

test('someone other than the assigned reviewer cannot declare on their behalf', function () {
    [, , $assignment] = coi_assignment();
    $outsider = User::factory()->create();
    $outsider->assignRole('reviewer');

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", ['has_conflict' => false])
        ->assertStatus(403);
});

test('a reviewer can report a real conflict with a reason, which notifies the assigning officer', function () {
    [$reviewer, $officer, $assignment] = coi_assignment();

    $response = $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", [
            'has_conflict' => true,
            'reason' => 'The PI is my former PhD supervisor.',
        ])
        ->assertOk();

    expect($response->json('data.coi_has_conflict'))->toBeTrue()
        ->and($response->json('data.coi_reason'))->toBe('The PI is my former PhD supervisor.');

    Bus::assertDispatched(StoreInAppNotificationJob::class);
    Bus::assertDispatched(SendRawMailJob::class);
});

test('reporting a conflict requires a reason', function () {
    [$reviewer, , $assignment] = coi_assignment();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", ['has_conflict' => true])
        ->assertStatus(422);
});

test('declaring twice does not overwrite the first declaration', function () {
    [$reviewer, , $assignment] = coi_assignment();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", ['has_conflict' => false])
        ->assertOk();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", [
            'has_conflict' => true, 'reason' => 'Trying to change my mind after the fact.',
        ])
        ->assertOk()
        ->assertJsonPath('message', 'COI already declared.');

    expect($assignment->fresh()->coi_has_conflict)->toBeFalse();
});

test('a reviewer who declared a conflict cannot submit a score for that assignment', function () {
    [$reviewer, , $assignment, $question] = coi_assignment();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", [
            'has_conflict' => true, 'reason' => 'Conflict of interest.',
        ])
        ->assertOk();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/score", [
            'answers' => [['question_id' => $question->id, 'score' => 90]],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', fn ($msg) => str_contains($msg, 'conflict of interest'));

    expect($assignment->fresh()->status)->not->toBe('submitted');
});

test('a reviewer who declared no conflict can submit a score normally', function () {
    [$reviewer, , $assignment, $question] = coi_assignment();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/declare-coi", ['has_conflict' => false])
        ->assertOk();

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/score", [
            'answers' => [['question_id' => $question->id, 'score' => 90]],
        ])
        ->assertOk();

    expect($assignment->fresh()->status)->toBe('submitted');
});
