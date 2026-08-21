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

function rc_makeBase(): array
{
    $college = College::create(['name' => 'RC College '.rand(), 'code' => 'RC'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RCD'.rand(10, 99)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'rc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $proposal = Proposal::create([
        'tracker_number' => 'RC-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_open_defence',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$college, $central, $proposal];
}

test('recalculate endpoint returns a live snapshot reflecting current settings, not the value at decision time', function () {
    [$college, $central, $proposal] = rc_makeBase();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $blindType = EvaluationType::create(['name' => 'blind_review_rc_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $blindCat = EvaluationCategory::create(['evaluation_type_id' => $blindType->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $blindQ = EvaluationQuestion::create(['evaluation_category_id' => $blindCat->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $blindAssignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $blindType->id, 'assigned_by' => $central->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $blindAssignment->id, 'evaluation_question_id' => $blindQ->id, 'score' => 60]);

    ThresholdSetting::create(['key' => 'blind_threshold', 'value' => 60]);
    ThresholdSetting::create(['key' => 'defence_threshold', 'value' => 10]);
    ThresholdSetting::create(['key' => 'combined_threshold', 'value' => 70]);

    $response = $this->actingAs($central, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate");
    $response->assertOk();

    $data = $response->json('data');
    expect($data['blind']['score'])->toEqual(60.0)
        ->and($data['blind']['max'])->toEqual(80.0)
        ->and($data['blind_passes'])->toBeTrue()
        ->and($data['blind_threshold'])->toEqual(60.0);

    // Now an admin raises the bar after the fact — the recalculated verdict must
    // immediately reflect the new setting, proving nothing is hardcoded or cached.
    ThresholdSetting::where('key', 'blind_threshold')->update(['value' => 65]);

    $response2 = $this->actingAs($central, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate");
    $data2 = $response2->json('data');

    expect($data2['blind_threshold'])->toEqual(65.0)
        ->and($data2['blind_passes'])->toBeFalse();
});

test('recalculate endpoint is forbidden for a reviewer without staff-tier access', function () {
    [$college, $central, $proposal] = rc_makeBase();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/review-results/recalculate")
        ->assertForbidden();
});

test('central evaluation queue flags a proposal whose open defence score is below defence_threshold', function () {
    [$college, $central, $proposal] = rc_makeBase();
    $proposal->update(['status' => 'accepted']);
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $blindType = EvaluationType::create(['name' => 'blind_review_rc2_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $blindCat = EvaluationCategory::create(['evaluation_type_id' => $blindType->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $blindQ = EvaluationQuestion::create(['evaluation_category_id' => $blindCat->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $defenceType = EvaluationType::create(['name' => 'open_defence_rc2_'.rand(1000, 9999), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $defenceCat = EvaluationCategory::create(['evaluation_type_id' => $defenceType->id, 'name' => 'B', 'order_index' => 1, 'weight' => 20]);
    $defenceQ = EvaluationQuestion::create(['evaluation_category_id' => $defenceCat->id, 'question_text' => 'Q', 'max_score' => 20, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $blindAssignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $blindType->id, 'assigned_by' => $central->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $blindAssignment->id, 'evaluation_question_id' => $blindQ->id, 'score' => 65]);

    $defenceAssignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $defenceType->id, 'assigned_by' => $central->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $defenceAssignment->id, 'evaluation_question_id' => $defenceQ->id, 'score' => 5]); // below defence_threshold(10)

    ThresholdSetting::create(['key' => 'blind_threshold', 'value' => 60]);
    ThresholdSetting::create(['key' => 'defence_threshold', 'value' => 10]);
    ThresholdSetting::create(['key' => 'combined_threshold', 'value' => 70]);

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/central-evaluation');
    $response->assertOk();

    $row = collect($response->json('data'))->firstWhere('id', $proposal->id);

    expect($row['defence_below_threshold'])->toBeTrue()
        ->and($row['defence_threshold'])->toEqual(10.0);
});
