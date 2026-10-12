<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\RepositoryService;
use App\Services\WorkflowService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function adal_makeProposal(string $status): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'AD'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'ADD'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ad-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'AD-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $central, $pi];
}

test('an automatic blind-review decision shows as System, not the actor account used to satisfy authorization', function () {
    [$proposal, $central] = adal_makeProposal('under_blind_review');
    app(WorkflowService::class)->transition($proposal, 'pass_blind_review', $central, 'Blind review passed. Average score: 74.25/80. Threshold: 60.', ['automatic' => true, 'average_score' => 74.25]);

    $viewer = User::factory()->create();
    $viewer->assignRole('super_admin');

    $response = $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/workflow-history")
        ->assertOk();

    $entry = collect($response->json('data'))->firstWhere('action', 'pass_blind_review');
    expect($entry['actor'])->toBe('System (Automatic)')
        ->and($entry['actor'])->not->toBe($central->name);
});

test('a manual transition still shows the real actor who performed it', function () {
    [$proposal, $central] = adal_makeProposal('submitted');
    app(WorkflowService::class)->transition($proposal, 'validate', $central, 'Proposal approved for review by Central Office');

    $viewer = User::factory()->create();
    $viewer->assignRole('super_admin');

    $response = $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/workflow-history")
        ->assertOk();

    $entry = collect($response->json('data'))->firstWhere('action', 'validate');
    expect($entry['actor'])->toBe($central->name);
});

test('the PI\'s own submission shows as "PI" to a non-admin viewer, not "Reviewer"', function () {
    [$proposal, , $pi] = adal_makeProposal('draft');
    app(WorkflowService::class)->transition($proposal, 'submit', $pi, 'Proposal submitted by PI');

    $categoryOfficer = User::factory()->create();
    $categoryOfficer->assignRole('research_officer');

    $response = $this->actingAs($categoryOfficer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/workflow-history")
        ->assertOk();

    $entry = collect($response->json('data'))->firstWhere('action', 'submit');
    expect($entry['actor'])->toBe('PI')
        ->and($entry['actor'])->not->toBe('Reviewer');
});

test('an admin viewer sees the PI\'s real name on the submission entry', function () {
    [$proposal, , $pi] = adal_makeProposal('draft');
    app(WorkflowService::class)->transition($proposal, 'submit', $pi, 'Proposal submitted by PI');

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/workflow-history")
        ->assertOk();

    $entry = collect($response->json('data'))->firstWhere('action', 'submit');
    expect($entry['actor'])->toBe($pi->name);
});

test('the public tracker also shows System for an automatic decision, not "RTT Office"', function () {
    [$proposal, $central] = adal_makeProposal('under_blind_review');
    app(WorkflowService::class)->transition($proposal, 'pass_blind_review', $central, 'Blind review passed automatically.', ['automatic' => true]);

    $status = app(RepositoryService::class)->getTrackerStatus($proposal->tracker_number);
    $entry = collect($status['history'])->firstWhere('action', 'pass_blind_review');

    expect($entry['actor'])->toBe('System')
        ->and($entry['actor'])->not->toBe('RTT Office');
});

test('the public tracker still labels a real central-office action "RTT Office"', function () {
    [$proposal, $central] = adal_makeProposal('submitted');
    app(WorkflowService::class)->transition($proposal, 'validate', $central, 'Proposal approved for review by Central Office');

    $status = app(RepositoryService::class)->getTrackerStatus($proposal->tracker_number);
    $entry = collect($status['history'])->firstWhere('action', 'validate');

    expect($entry['actor'])->toBe('RTT Office');
});
