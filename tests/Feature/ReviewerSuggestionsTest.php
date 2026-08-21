<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new ThresholdSettingSeeder)->run();
});

function suggestions_makeProposal(): Proposal
{
    $college = College::create(['name' => 'Suggest College '.rand(), 'code' => 'SC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'SD'.rand(10000, 99999)]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Suggest Call', 'slug' => 'suggest-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $pi->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'SG-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'Machine Learning for Crop Yield Prediction',
        'keywords' => 'machine learning, agriculture',
        'status' => 'validated',
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);
}

test('reviewer suggestions include external reviewers with matching expertise', function () {
    $proposal = suggestions_makeProposal();

    $centralOfficer = User::factory()->create();
    $centralOfficer->assignRole('central_officer');

    $externalReviewer = User::factory()->create(['expertise' => ['machine learning']]);
    $externalReviewer->assignRole('external_reviewer');

    $staffReviewer = User::factory()->create(['expertise' => ['machine learning']]);
    $staffReviewer->assignRole('staff');

    $response = $this->actingAs($centralOfficer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/reviewer-suggestions");

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($externalReviewer->id)
        ->toContain($staffReviewer->id);
});

test('reviewer suggestions exclude users without staff or external_reviewer roles', function () {
    $proposal = suggestions_makeProposal();

    $centralOfficer = User::factory()->create();
    $centralOfficer->assignRole('central_officer');

    $otherPi = User::factory()->create(['expertise' => ['machine learning']]);
    $otherPi->assignRole('pi');

    $response = $this->actingAs($centralOfficer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/reviewer-suggestions");

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->not->toContain($otherPi->id);
});

test('a reviewer with a better on-time rate ranks above an equally-matched but unreliable one', function () {
    $proposal = suggestions_makeProposal();

    $centralOfficer = User::factory()->create();
    $centralOfficer->assignRole('central_officer');

    $evalType = EvaluationType::create(['name' => 'blind_review', 'label' => 'Blind Review', 'is_active' => true]);

    $reliable = User::factory()->create(['expertise' => ['machine learning']]);
    $reliable->assignRole('staff');
    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reliable->id,
        'evaluation_type_id' => $evalType->id,
        'assigned_by' => $centralOfficer->id,
        'status' => 'submitted',
        'assigned_at' => now()->subDays(10),
        'due_date' => now()->subDays(5)->toDateString(),
        'submitted_at' => now()->subDays(6), // before due date
    ]);

    $unreliable = User::factory()->create(['expertise' => ['machine learning']]);
    $unreliable->assignRole('staff');
    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $unreliable->id,
        'evaluation_type_id' => $evalType->id,
        'assigned_by' => $centralOfficer->id,
        'status' => 'submitted',
        'assigned_at' => now()->subDays(10),
        'due_date' => now()->subDays(5)->toDateString(),
        'submitted_at' => now(), // long after due date
    ]);

    $response = $this->actingAs($centralOfficer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/reviewer-suggestions");

    $response->assertOk();
    $data = collect($response->json('data'));

    $reliableEntry = $data->firstWhere('id', $reliable->id);
    $unreliableEntry = $data->firstWhere('id', $unreliable->id);

    expect($reliableEntry['on_time_rate'])->toBe(100)
        ->and($unreliableEntry['on_time_rate'])->toBe(0)
        ->and($reliableEntry['match_score'])->toBe($unreliableEntry['match_score']);

    $reliableIndex = $data->search(fn ($r) => $r['id'] === $reliable->id);
    $unreliableIndex = $data->search(fn ($r) => $r['id'] === $unreliable->id);
    expect($reliableIndex)->toBeLessThan($unreliableIndex);
});
