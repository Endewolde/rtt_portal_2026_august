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
use App\Services\ProposalCallService;
use App\Services\ReviewScoreService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    ThresholdSetting::updateOrCreate(['key' => 'defence_threshold'], ['value' => 10]);
    ThresholdSetting::updateOrCreate(['key' => 'combined_threshold'], ['value' => 70]);

    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $college = College::create(['name' => 'Route College', 'code' => 'RR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RRD'.rand(10000, 99999)]);
    $this->call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Route Call', 'slug' => 'rr-'.rand(10000, 99999),
        'start_date' => now(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->admin->id,
    ]);
    $this->proposal = Proposal::create([
        'tracker_number' => 'RR-'.rand(100000, 999999), 'proposal_call_id' => $this->call->id, 'category' => 'research',
        'title' => 'Routed', 'status' => 'under_blind_review', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026-2027', 'created_by' => $pi->id,
    ]);
});

/** A submitted blind review scoring `$score` out of 80. */
function route_blindScore(Proposal $proposal, User $actor, int $score): void
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = EvaluationType::create(['name' => 'blind_review_'.Str::random(6), 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $q = EvaluationQuestion::create(['evaluation_category_id' => $cat->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);
    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id, 'assigned_by' => $actor->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => $score]);
}

test('an admin saves a review route and only what differs from the standard is kept', function () {
    $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/proposal-calls/{$this->call->id}/review-route", [
        'open_defence' => false, 'blind_reviewers' => 2, 'blind_threshold' => 50, 'combined_threshold' => 90,
    ])->assertOk()->assertJsonPath('data.review_route.open_defence', false)
        ->assertJsonPath('data.review_route.combined_threshold', null);

    $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/proposal-calls/{$this->call->id}/review-route")
        ->assertOk()
        ->assertJsonPath('data.route.blind_reviewers', 2)
        ->assertJsonPath('data.standard.blind_threshold', 60)
        ->assertJsonPath('data.customised', true);

    $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/proposal-calls/{$this->call->id}/review-route", ['open_defence' => true])->assertOk();
    expect($this->call->fresh()->review_route)->toBeNull();
});

test('people who cannot edit calls cannot change the route', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->putJson("/api/v1/proposal-calls/{$this->call->id}/review-route", ['open_defence' => false])->assertForbidden();
});

test('a call pass mark replaces the standard one, as raw points', function () {
    route_blindScore($this->proposal, $this->admin, 55);
    $service = app(ReviewScoreService::class);

    expect($service->recalculateSnapshot($this->proposal->fresh())['blind_passes'])->toBeFalse();

    $this->call->update(['review_route' => ['open_defence' => true, 'blind_threshold' => 50]]);
    $snapshot = $service->recalculateSnapshot($this->proposal->fresh());

    expect($snapshot['blind_threshold'])->toBe(50.0)->and($snapshot['blind_passes'])->toBeTrue();

    $service->processBlindReviewResult($this->proposal->fresh());
    expect($this->proposal->fresh()->status)->toBe('blind_review_passed');
});

test('the decision waits until the call asks for enough reviewers', function () {
    $this->call->update(['review_route' => ['open_defence' => true, 'blind_reviewers' => 2]]);
    $service = app(ReviewScoreService::class);

    route_blindScore($this->proposal, $this->admin, 70);
    $service->processBlindReviewResult($this->proposal->fresh());
    expect($this->proposal->fresh()->status)->toBe('under_blind_review');

    route_blindScore($this->proposal, $this->admin, 72);
    $service->processBlindReviewResult($this->proposal->fresh());
    expect($this->proposal->fresh()->status)->toBe('blind_review_passed');
});

test('a call without open defence goes straight to central evaluation on a blind pass', function () {
    $this->call->update(['review_route' => ['open_defence' => false]]);
    route_blindScore($this->proposal, $this->admin, 70);

    app(ReviewScoreService::class)->processBlindReviewResult($this->proposal->fresh());

    $proposal = $this->proposal->fresh();
    expect($proposal->status)->toBe('accepted')
        ->and($proposal->workflowLogs()->pluck('action')->all())->toContain('pass_blind_review', 'skip_defence');

    $snapshot = app(ReviewScoreService::class)->recalculateSnapshot($proposal);
    expect($snapshot['skips_defence'])->toBeTrue()
        ->and($snapshot['combined_passes'])->toBeTrue()
        ->and($snapshot['combined_threshold'])->toBe(60.0);
});

test('a blind fail on a call without defence is still rejected', function () {
    $this->call->update(['review_route' => ['open_defence' => false]]);
    route_blindScore($this->proposal, $this->admin, 40);

    app(ReviewScoreService::class)->processBlindReviewResult($this->proposal->fresh());

    expect($this->proposal->fresh()->status)->toBe('rejected');
});

test('the route is read even when the call is loaded with only a few columns', function () {
    $this->call->update(['review_route' => ['open_defence' => true, 'blind_threshold' => 50]]);
    route_blindScore($this->proposal, $this->admin, 55);

    $proposal = Proposal::with('proposalCall:id,title')->find($this->proposal->id);

    expect(app(ReviewScoreService::class)->recalculateSnapshot($proposal)['blind_threshold'])->toBe(50.0);
});

test('a copied call keeps its review route', function () {
    $this->call->update(['review_route' => ['open_defence' => false, 'blind_reviewers' => 3]]);

    $copy = app(ProposalCallService::class)->copy($this->call->fresh(), [], $this->admin);

    expect($copy->review_route['blind_reviewers'])->toBe(3);
});
