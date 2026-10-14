<?php

use App\Models\College;
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

function aet_awardedProposal(string $category = 'research', ?string $title = null): array
{
    $college = College::create(['name' => 'AET College '.rand(), 'code' => 'AET'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AETD'.rand(10000, 99999)]);
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'Call', 'slug' => 'aet-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $officer->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'AET-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => $title ?? 'Proposal '.rand(100000, 999999), 'status' => 'funded',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
        'contract_status' => 'approved',
        'contract_submitted_at' => now()->subDays(3),
        'contract_signed_at' => now(),
        'contract_signed_by' => $officer->id,
    ]);

    return [$proposal, $pi, $officer];
}

test('a plain staff member cannot export awarded proposals', function () {
    [, $pi] = aet_awardedProposal();

    $this->actingAs($pi, 'sanctum')
        ->get('/api/v1/proposals/awarded/export')
        ->assertStatus(403);
});

test('a central officer can export and the CSV includes contract columns', function () {
    [$proposal, , $officer] = aet_awardedProposal();

    $response = $this->actingAs($officer, 'sanctum')->get('/api/v1/proposals/awarded/export');
    $response->assertOk();
    $csv = $response->streamedContent();

    expect($csv)->toContain('Contract Status')
        ->and($csv)->toContain('Approved')
        ->and($csv)->toContain($officer->name);
});

test('a research_officer export is scoped to the research category', function () {
    [$researchProposal, , $officer] = aet_awardedProposal('research', 'Distinctive Research Title');
    [$communityProposal] = aet_awardedProposal('community_engagement', 'Distinctive Community Title');

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')->get('/api/v1/proposals/awarded/export');
    $csv = $response->streamedContent();

    expect($csv)->toContain($researchProposal->title)
        ->and($csv)->not->toContain($communityProposal->title);
});

test('a research_officer cannot request another category via the query param', function () {
    aet_awardedProposal('research');
    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $this->actingAs($researchOfficer, 'sanctum')
        ->get('/api/v1/proposals/awarded/export?category=community_engagement')
        ->assertStatus(403);
});
