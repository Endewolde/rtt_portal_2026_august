<?php

use App\Models\College;
use App\Models\Department;
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
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::create(['name' => 'Quality College', 'code' => 'QC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'QD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'qc-'.rand(10000, 99999),
        'start_date' => now(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->pi = User::factory()->create();
    $this->proposal = Proposal::create([
        'tracker_number' => 'QR-1', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'Quality',
        'status' => 'blind_review_passed', 'pi_user_id' => $this->pi->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026-2027', 'created_by' => $this->pi->id,
    ]);
    $type = EvaluationType::create(['name' => 'blind_review_qr', 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $this->reviewer = User::factory()->create();
    $this->assignment = ReviewAssignment::create([
        'proposal_id' => $this->proposal->id, 'reviewer_id' => $this->reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $this->central->id, 'status' => 'submitted', 'assigned_at' => now()->subWeek(), 'submitted_at' => now(),
        'due_date' => now()->addDay()->toDateString(),
    ]);
});

test('the office rates a review, and the reviewer sees their own record', function () {
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/review-assignments/{$this->assignment->id}/quality", ['rating' => 3])
        ->assertOk()->assertJsonPath('data.quality_rating', 3);

    $this->actingAs($this->reviewer, 'sanctum')->getJson('/api/v1/my-review-quality')
        ->assertJsonPath('data.rated', 1)
        ->assertJsonPath('data.useful', 1);
});

test('only the office sees who wrote which review and can rate it', function () {
    $this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/review-results")
        ->assertJsonPath('data.can_rate', true)
        ->assertJsonPath('data.reviews.0.assignment_id', $this->assignment->id);

    $this->actingAs($this->pi, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/review-results")
        ->assertJsonPath('data.can_rate', false)
        ->assertJsonMissingPath('data.reviews.0.assignment_id');

    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/review-assignments/{$this->assignment->id}/quality", ['rating' => 1])->assertForbidden();
});

test('a review that is not submitted cannot be rated', function () {
    $this->assignment->update(['status' => 'in_progress', 'submitted_at' => null]);

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/review-assignments/{$this->assignment->id}/quality", ['rating' => 2])->assertUnprocessable();
});
