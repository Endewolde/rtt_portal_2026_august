<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewerAgreement;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->reviewer = User::factory()->create();
    $this->reviewer->assignRole('staff');
    $officer = User::factory()->create();
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'ra-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $officer->id,
    ]);
    $proposal = Proposal::create(['tracker_number' => 'RA-'.rand(10000, 99999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review', 'pi_user_id' => $officer->id, 'college_id' => $college->id, 'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $officer->id]);
    $type = EvaluationType::create(['name' => 'blind_review_ra', 'label' => 'B', 'proposal_category' => 'research', 'is_active' => true]);
    $this->assignment = ReviewAssignment::create(['proposal_id' => $proposal->id, 'reviewer_id' => $this->reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $officer->id, 'status' => 'pending', 'assigned_at' => now()]);
});

test('a reviewer must accept the agreement before opening a proposal, once a year', function () {
    $this->actingAs($this->reviewer, 'sanctum')->getJson("/api/v1/review-assignments/{$this->assignment->id}")
        ->assertForbidden()->assertJsonPath('meta.code', 'agreement_required');

    $this->actingAs($this->reviewer, 'sanctum')->postJson('/api/v1/reviewer-agreement', ['confirm' => true])->assertOk();

    $this->actingAs($this->reviewer, 'sanctum')->getJson("/api/v1/review-assignments/{$this->assignment->id}")->assertOk();
    expect(ReviewerAgreement::first()->agreement_text)->toContain('confidential');
});

test('someone who is not the reviewer or an officer cannot open an assignment', function () {
    $stranger = User::factory()->create();
    $stranger->assignRole('staff');
    acceptReviewerAgreement($stranger);

    $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/review-assignments/{$this->assignment->id}")->assertForbidden();
});
