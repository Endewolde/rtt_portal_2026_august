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

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    $this->collegeA = College::create(['name' => 'College A', 'code' => 'CA'.rand(10000, 99999)]);
    $this->collegeB = College::create(['name' => 'College B', 'code' => 'CB'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $this->collegeA->id, 'name' => 'D', 'code' => 'CD'.rand(10000, 99999)]);

    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Research Call 2026', 'slug' => 'rc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
});

function pcs_proposal(object $ctx, string $status, ?College $college = null, ?ProposalCall $call = null, string $category = 'research'): Proposal
{
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    return Proposal::create([
        'tracker_number' => 'PC-'.rand(100000, 999999), 'proposal_call_id' => ($call ?? $ctx->call)->id,
        'category' => $category, 'title' => 'P '.rand(), 'status' => $status, 'pi_user_id' => $pi->id,
        'college_id' => ($college ?? $ctx->collegeA)->id, 'department_id' => $ctx->dept->id,
        'academic_year' => '2026', 'created_by' => $pi->id, 'submitted_at' => $status === 'draft' ? null : now(),
    ]);
}

test('lists a call\'s submitted proposals with figures, counting drafts separately', function () {
    pcs_proposal($this, 'submitted');
    pcs_proposal($this, 'under_blind_review');
    pcs_proposal($this, 'rejected', $this->collegeB);
    pcs_proposal($this, 'draft');
    $otherCall = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Other', 'slug' => 'oc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    pcs_proposal($this, 'submitted', null, $otherCall);

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposal-calls/{$this->call->id}/submissions")
        ->assertOk()
        ->assertJsonPath('data.call.title', 'Research Call 2026')
        ->assertJsonCount(3, 'data.proposals')
        ->assertJsonPath('data.stats.submitted', 3)
        ->assertJsonPath('data.stats.drafts', 1)
        ->assertJsonPath('data.stats.by_status.submitted', 1)
        ->assertJsonPath('data.stats.by_status.rejected', 1)
        ->assertJsonPath('data.stats.by_college.College A', 2)
        ->assertJsonStructure(['data' => ['proposals' => [['id', 'tracker_number', 'title', 'status', 'pi' => ['name', 'email'], 'college', 'reviews_total', 'reviews_submitted']]]]);
});

test('a college officer only sees their own college\'s submissions', function () {
    pcs_proposal($this, 'submitted');
    pcs_proposal($this, 'submitted', $this->collegeB);
    $officer = User::factory()->create(['college_id' => $this->collegeA->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->getJson("/api/v1/proposal-calls/{$this->call->id}/submissions")
        ->assertOk()
        ->assertJsonCount(1, 'data.proposals')
        ->assertJsonPath('data.proposals.0.college.name', 'College A');
});

test('a category director only sees their own category', function () {
    pcs_proposal($this, 'submitted', null, null, 'research');
    pcs_proposal($this, 'submitted', null, null, 'community_engagement');
    $director = User::factory()->create();
    $director->assignRole('community_officer');

    $this->actingAs($director, 'sanctum')
        ->getJson("/api/v1/proposal-calls/{$this->call->id}/submissions")
        ->assertOk()
        ->assertJsonCount(1, 'data.proposals')
        ->assertJsonPath('data.proposals.0.category', 'community_engagement');
});

test('staff cannot open a call\'s submissions', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->getJson("/api/v1/proposal-calls/{$this->call->id}/submissions")
        ->assertForbidden();
});

test('the Proposal Calls list counts only submitted proposals, not drafts', function () {
    pcs_proposal($this, 'submitted');
    pcs_proposal($this, 'rejected');
    pcs_proposal($this, 'draft');
    pcs_proposal($this, 'draft');

    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposal-calls/all?academic_year=all')->assertOk();

    expect(collect($response->json('data'))->firstWhere('id', $this->call->id)['proposals_count'])->toBe(2);
});

test('a college officer\'s count matches what their Submissions page shows', function () {
    pcs_proposal($this, 'submitted');
    pcs_proposal($this, 'submitted', $this->collegeB);
    pcs_proposal($this, 'draft');
    $officer = User::factory()->create(['college_id' => $this->collegeA->id]);
    $officer->assignRole('college_officer');

    $list = $this->actingAs($officer, 'sanctum')->getJson('/api/v1/proposal-calls')->assertOk();
    $count = collect($list->json('data.data') ?? $list->json('data'))->firstWhere('id', $this->call->id)['proposals_count'];

    $page = $this->actingAs($officer, 'sanctum')->getJson("/api/v1/proposal-calls/{$this->call->id}/submissions")->assertOk();

    expect($count)->toBe(1)
        ->and($page->json('data.stats.submitted'))->toBe($count);
});
