<?php

use App\Models\Award;
use App\Models\College;
use App\Models\DeadlineExtensionRequest;
use App\Models\Department;
use App\Models\NoCostExtensionRequest;
use App\Models\Proposal;
use App\Models\ProposalAppeal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Storage::fake('private');

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->researchDirector = User::factory()->create();
    $this->researchDirector->assignRole('research_officer');
    $this->communityDirector = User::factory()->create();
    $this->communityDirector->assignRole('community_officer');
});

/** A proposal in a programme and status, with its own PI. */
function rq_proposal(string $category, string $status): Proposal
{
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => $category, 'title' => 'Call', 'slug' => 'rq-'.rand(10000, 99999),
        'start_date' => now()->subMonth(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $pi->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'RQ-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'pi_user_id' => $pi->id,
        'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'Queued', 'status' => $status,
        'category' => $category, 'academic_year' => '2026-2027', 'created_by' => $pi->id, 'duration_months' => 12,
    ]);
}

test('only the research team can appeal a rejected proposal', function () {
    $proposal = rq_proposal('research', 'rejected');
    $stranger = User::factory()->create();
    $stranger->assignRole('staff');

    $this->actingAs($stranger, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/appeal", ['reason' => str_repeat('Please reconsider this. ', 3)])
        ->assertForbidden();
});

test('directors see and decide only their own programme’s appeals, with full counts', function () {
    $research = rq_proposal('research', 'rejected');
    $community = rq_proposal('community_engagement', 'rejected');
    $mine = ProposalAppeal::create(['proposal_id' => $research->id, 'submitted_by' => $research->pi_user_id, 'reason' => 'Mine', 'status' => 'pending']);
    $theirs = ProposalAppeal::create(['proposal_id' => $community->id, 'submitted_by' => $community->pi_user_id, 'reason' => 'Theirs', 'status' => 'pending']);

    $this->actingAs($this->researchDirector, 'sanctum')->getJson('/api/v1/appeals')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine->id)->assertJsonPath('meta.counts.pending', 1);
    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/appeals')->assertOk()->assertJsonCount(2, 'data');

    $this->actingAs($this->researchDirector, 'sanctum')
        ->postJson("/api/v1/appeals/{$theirs->id}/resolve", ['decision' => 'approved', 'resolution_notes' => 'Not my programme at all.'])
        ->assertForbidden();
    expect($community->fresh()->status)->toBe('rejected');
});

test('deadline extensions are listed and decided within scope', function () {
    $research = rq_proposal('research', 'draft');
    $community = rq_proposal('community_engagement', 'draft');
    DeadlineExtensionRequest::create(['proposal_id' => $research->id, 'requested_by' => $research->pi_user_id, 'reason' => 'More time', 'requested_until' => now()->addWeek(), 'status' => 'pending']);
    $theirs = DeadlineExtensionRequest::create(['proposal_id' => $community->id, 'requested_by' => $community->pi_user_id, 'reason' => 'More time', 'requested_until' => now()->addWeek(), 'status' => 'pending']);

    $this->actingAs($this->researchDirector, 'sanctum')->getJson('/api/v1/deadline-extensions')->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs($this->researchDirector, 'sanctum')
        ->postJson("/api/v1/deadline-extensions/{$theirs->id}/resolve", ['decision' => 'denied', 'resolution_notes' => 'Not my programme at all.'])
        ->assertForbidden();
});

test('no-cost extensions list beyond twenty, stay in scope and need a running project', function () {
    foreach (range(1, 22) as $n) {
        $p = rq_proposal('research', 'funded');
        NoCostExtensionRequest::create(['proposal_id' => $p->id, 'requested_by' => $p->pi_user_id, 'reason' => 'Field delays', 'current_duration_months' => 12, 'requested_duration_months' => 18, 'status' => 'pending']);
    }
    $community = rq_proposal('community_engagement', 'funded');
    $theirs = NoCostExtensionRequest::create(['proposal_id' => $community->id, 'requested_by' => $community->pi_user_id, 'reason' => 'Delays', 'current_duration_months' => 12, 'requested_duration_months' => 18, 'status' => 'pending']);

    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/no-cost-extensions')->assertOk()->assertJsonCount(23, 'data')->assertJsonPath('meta.counts.pending', 23);
    $this->actingAs($this->researchDirector, 'sanctum')->postJson("/api/v1/no-cost-extensions/{$theirs->id}/approve")->assertForbidden();

    $community->update(['status' => 'completed']);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/no-cost-extensions/{$theirs->id}/approve")->assertUnprocessable();
    expect($community->fresh()->duration_months)->toBe(12);
});

test('grant letters are issued only in the signer’s scope, one file per award', function () {
    $a = rq_proposal('research', 'funded');
    $b = rq_proposal('research', 'midterm_evaluation');
    $other = rq_proposal('community_engagement', 'funded');
    foreach ([$a, $b, $other] as $i => $p) {
        Award::create(['proposal_id' => $p->id, 'awarded_amount' => 50000, 'approved_by' => $this->central->id, 'approved_at' => now(), 'grant_reference' => "WSU/RTT/2026/00{$i}"]);
    }

    $this->actingAs($this->researchDirector, 'sanctum')
        ->postJson('/api/v1/awards/approve-letters', ['signatoryName' => 'Dr. Director'])
        ->assertOk()
        ->assertJsonPath('data.count', 2);

    $paths = Award::whereIn('proposal_id', [$a->id, $b->id])->pluck('grant_letter_path');
    expect($paths->unique())->toHaveCount(2)
        ->and($paths->every(fn ($path) => substr_count($path, '/') === 1))->toBeTrue()
        ->and(Award::where('proposal_id', $other->id)->value('grant_letter_approved_at'))->toBeNull();
});

test('the grant letter template is saved on the server and comes back with the letterhead', function () {
    $this->actingAs($this->researchDirector, 'sanctum')
        ->putJson('/api/v1/awards/letter-template', ['signatoryName' => 'Dr. Almaz', 'signatoryTitle' => 'Vice President', 'fileNo' => 'WSU/RTT/12', 'date' => '1 March 2027', 'cc' => ['Finance']])
        ->assertOk();

    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/awards/letter-template')
        ->assertOk()
        ->assertJsonPath('data.signatoryName', 'Dr. Almaz')
        ->assertJsonPath('data.date', '1 March 2027')
        ->assertJsonPath('data.cc.0', 'Finance')
        ->assertJsonStructure(['meta' => ['head' => ['orgName', 'currencyName']]]);

    $this->actingAs($this->researchDirector, 'sanctum')->putJson('/api/v1/awards/letter-template', ['signatoryName' => 'Dr. B'])->assertOk();
    expect(DB::table('app_settings')->where('key', 'grant_letter_template')->count())->toBe(1);

    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff, 'sanctum')->putJson('/api/v1/awards/letter-template', ['signatoryName' => 'X'])->assertForbidden();
});
