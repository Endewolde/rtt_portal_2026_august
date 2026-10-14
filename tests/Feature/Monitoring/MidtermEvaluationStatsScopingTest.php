<?php

use App\Models\College;
use App\Models\Department;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function mets_makeProposal(string $category = 'research'): Proposal
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $college = College::create(['name' => 'METS College '.rand(), 'code' => 'MS'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'MSD'.rand(10000, 99999)]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'METS Call', 'slug' => 'mets-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'METS-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'METS Proposal', 'status' => 'midterm_evaluation',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

test('a research officer only sees midterm stats for their own category, not the platform-wide totals', function () {
    $researchProposal = mets_makeProposal('research');
    $techProposal = mets_makeProposal('technology_transfer');
    MidtermEvaluation::create(['proposal_id' => $researchProposal->id, 'evaluation_date' => now()->toDateString(), 'status' => 'scheduled', 'scheduled_by' => $researchProposal->pi_user_id]);
    MidtermEvaluation::create(['proposal_id' => $techProposal->id, 'evaluation_date' => now()->toDateString(), 'status' => 'scheduled', 'scheduled_by' => $techProposal->pi_user_id]);

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')->getJson('/api/v1/midterm-evaluations/stats');

    $response->assertOk();
    expect($response->json('data.total'))->toBe(1);
});
