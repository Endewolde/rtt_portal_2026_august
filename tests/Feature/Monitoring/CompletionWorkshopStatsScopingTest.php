<?php

use App\Models\College;
use App\Models\CompletionWorkshop;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function cwts_makeProposal(string $category = 'research'): Proposal
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $college = College::create(['name' => 'CWTS College '.rand(), 'code' => 'CW'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CWD'.rand(10000, 99999)]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'CWTS Call', 'slug' => 'cwts-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'CWTS-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'CWTS Proposal', 'status' => 'midterm_evaluation',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

test('a community officer only sees completion workshop stats for their own category, not the platform-wide totals', function () {
    $communityProposal = cwts_makeProposal('community_engagement');
    $researchProposal = cwts_makeProposal('research');
    CompletionWorkshop::create(['proposal_id' => $communityProposal->id, 'scheduled_date' => now()->addDays(5)->toDateString(), 'scheduled_time' => '10:00', 'venue' => 'Hall A', 'status' => 'scheduled', 'scheduled_by' => $communityProposal->pi_user_id]);
    CompletionWorkshop::create(['proposal_id' => $researchProposal->id, 'scheduled_date' => now()->addDays(5)->toDateString(), 'scheduled_time' => '10:00', 'venue' => 'Hall A', 'status' => 'scheduled', 'scheduled_by' => $researchProposal->pi_user_id]);

    $communityOfficer = User::factory()->create();
    $communityOfficer->assignRole('community_officer');

    $response = $this->actingAs($communityOfficer, 'sanctum')->getJson('/api/v1/completion-workshops/stats');

    $response->assertOk();
    expect($response->json('data.total'))->toBe(1);
});
