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
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('central evaluation queue reports the raw point threshold, not a percentage of the category-weight sum', function () {
    ThresholdSetting::create(['key' => 'combined_threshold', 'value' => 70]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'CE'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CED'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ce-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $proposal = Proposal::create([
        'tracker_number' => 'CE-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'accepted',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    // Blind (weight 80) + defence (weight 20) => totalMax 100. Under the old buggy
    // formula (thresholdPct / 100 * totalMax), 70/100*100 = 70 — coincidentally the
    // same number, which is exactly why this bug went unnoticed. This test locks in
    // that the raw value is used directly rather than that fragile coincidence.
    $blindType = EvaluationType::create(['name' => 'blind_review_ce_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $blindCat = EvaluationCategory::create(['evaluation_type_id' => $blindType->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $blindQ = EvaluationQuestion::create(['evaluation_category_id' => $blindCat->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $defenceType = EvaluationType::create(['name' => 'open_defence_ce_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $defenceCat = EvaluationCategory::create(['evaluation_type_id' => $defenceType->id, 'name' => 'B', 'order_index' => 1, 'weight' => 20]);
    $defenceQ = EvaluationQuestion::create(['evaluation_category_id' => $defenceCat->id, 'question_text' => 'Q', 'max_score' => 20, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $blindAssignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $blindType->id, 'assigned_by' => $central->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $blindAssignment->id, 'evaluation_question_id' => $blindQ->id, 'score' => 60]);

    $defenceAssignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $defenceType->id, 'assigned_by' => $central->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $defenceAssignment->id, 'evaluation_question_id' => $defenceQ->id, 'score' => 15]);

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/central-evaluation');

    $response->assertOk();
    $row = collect($response->json('data'))->firstWhere('id', $proposal->id);

    expect($row)->not->toBeNull()
        ->and($row['threshold'])->toEqual(70.0)
        ->and($row['threshold_pct'])->toEqual(70.0)
        ->and($row['total_max'])->toEqual(100.0)
        ->and($row['combined_score'])->toEqual(75.0)
        // Scores arrive summarised; the raw assignments and questions stay on the server.
        ->and($row)->not->toHaveKey('review_assignments')
        ->and($row)->not->toHaveKey('budgets')
        ->and($row['skips_defence'])->toBeFalse()
        ->and($row['blind_reviewers'])->toBe(1)
        ->and($row['defence_reviewers'])->toBe(1);
});
