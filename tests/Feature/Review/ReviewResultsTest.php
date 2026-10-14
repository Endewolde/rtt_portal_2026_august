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
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('review results endpoint returns the weighted score and max, not a naive raw average', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'RR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RRD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'rr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'RR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $type = EvaluationType::create([
        'name' => 'blind_review_test_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    // Two categories with different weights — the weighted total (60) is very
    // different from a naive raw-score average (2.5), which is exactly the bug.
    $catA = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 60]);
    $catB = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'B', 'order_index' => 2, 'weight' => 40]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $admin->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);

    foreach ([$catA, $catB] as $cat) {
        for ($i = 0; $i < 2; $i++) {
            $q = EvaluationQuestion::create([
                'evaluation_category_id' => $cat->id,
                'question_text' => "Q{$i}",
                'max_score' => 5,
                'weight' => 1.00,
                'is_required' => true,
                'order_index' => $i + 1,
            ]);

            ReviewScore::create([
                'review_assignment_id' => $assignment->id,
                'evaluation_question_id' => $q->id,
                // Full marks in the 60%-weighted category, zero in the 40%-weighted one.
                'score' => $cat->id === $catA->id ? 5 : 0,
            ]);
        }
    }

    $response = $this->actingAs($pi, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/review-results");

    $response->assertOk();
    $data = $response->json('data');

    expect($data['average_score'])->toEqual(60.0)
        ->and($data['average_max'])->toEqual(100.0)
        ->and($data['reviews'][0]['overall_score'])->toEqual(60.0)
        ->and($data['reviews'][0]['overall_max'])->toEqual(100.0);
});

test('review results endpoint falls back to raw points out of raw max when categories are unweighted', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'RU'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RUD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ru-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'RU-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $type = EvaluationType::create([
        'name' => 'blind_review_test_'.rand(1000, 9999),
        'label' => 'Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 0]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $admin->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);

    for ($i = 0; $i < 4; $i++) {
        $q = EvaluationQuestion::create([
            'evaluation_category_id' => $cat->id,
            'question_text' => "Q{$i}",
            'max_score' => 5,
            'weight' => 1.00,
            'is_required' => true,
            'order_index' => $i + 1,
        ]);

        ReviewScore::create([
            'review_assignment_id' => $assignment->id,
            'evaluation_question_id' => $q->id,
            'score' => 3,
        ]);
    }

    $response = $this->actingAs($pi, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/review-results");

    $response->assertOk();
    $data = $response->json('data');

    expect($data['average_score'])->toEqual(12.0)
        ->and($data['average_max'])->toEqual(20.0);
});
