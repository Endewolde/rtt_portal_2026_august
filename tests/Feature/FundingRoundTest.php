<?php

use App\Models\Award;
use App\Models\College;
use App\Models\Department;
use App\Models\FundingRound;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    $this->college = College::create(['name' => 'Round College', 'code' => 'RC'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'RCD'.rand(10000, 99999)]);
    $this->call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Research Call 2026', 'slug' => 'rc-'.rand(10000, 99999),
        'start_date' => now()->subMonth(), 'end_date' => now()->subDay(), 'status' => 'active', 'is_open' => false,
        'created_by' => $this->central->id, 'funding_budget' => 250000,
    ]);

    // Three proposals waiting for the decision, asking 100k each; one already funded elsewhere is ignored.
    $this->waiting = collect(range(1, 3))->map(fn ($n) => rnd_proposal($this, 'accepted', 100000, "RC-{$n}"));
    rnd_proposal($this, 'under_open_defence', 100000, 'RC-X');
});

function rnd_proposal(object $t, string $status, float $requested, string $tracker): Proposal
{
    $pi = User::factory()->create(['college_id' => $t->college->id, 'department_id' => $t->dept->id]);
    $pi->assignRole('staff');
    $p = Proposal::create([
        'tracker_number' => $tracker, 'proposal_call_id' => $t->call->id, 'category' => 'research', 'title' => "Proposal {$tracker}",
        'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $t->college->id, 'department_id' => $t->dept->id,
        'academic_year' => '2026-2027', 'created_by' => $pi->id,
    ]);
    ProposalBudget::create(['proposal_id' => $p->id, 'category' => 'Supplies', 'item_description' => 'Things', 'amount' => $requested]);

    return $p;
}

function rnd_draft(object $t): array
{
    return test()->actingAs($t->central, 'sanctum')->getJson("/api/v1/funding-rounds/call/{$t->call->id}")->assertOk()->json('data');
}

test('opening a call starts a draft round with every proposal waiting for the decision', function () {
    $round = rnd_draft($this);

    expect($round['status'])->toBe('draft')
        ->and($round['items'])->toHaveCount(3)
        ->and(collect($round['items'])->pluck('decision')->unique()->all())->toBe(['pending'])
        ->and($round['budget']['budget'])->toEqual(250000)
        ->and($round['budget']['remaining'])->toEqual(250000);

    // Opening it again keeps the same draft.
    expect(rnd_draft($this)['id'])->toBe($round['id']);
});

test('the call list shows calls with proposals waiting', function () {
    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/funding-rounds/calls')
        ->assertOk()
        ->assertJsonPath('data.0.id', $this->call->id)
        ->assertJsonPath('data.0.waiting', 3);
});

test('filling from the ranking funds while the money lasts and reserves the rest', function () {
    $round = rnd_draft($this);

    $filled = $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/auto-fill")->assertOk()->json('data');

    expect($filled['counts']['fund'])->toBe(2)
        ->and($filled['counts']['reserve'])->toBe(1)
        ->and($filled['budget']['funding'])->toEqual(200000)
        ->and($filled['budget']['after'])->toEqual(50000);
});

test('drafts tell nobody; publishing applies every decision at once', function () {
    $round = rnd_draft($this);
    [$a, $b, $c] = $round['items'];
    $put = fn ($item, $data) => $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$item['id']}", $data)->assertOk();

    $put($a, ['decision' => 'fund', 'amount' => 90000, 'remarks' => 'Trim travel']);
    $put($b, ['decision' => 'reserve']);
    $put($c, ['decision' => 'reject', 'reason_code' => 'funds_unavailable']);

    // Nothing has happened to the proposals yet.
    expect(Proposal::whereIn('id', collect($round['items'])->pluck('proposal_id'))->pluck('status')->unique()->all())->toBe(['accepted'])
        ->and(Award::count())->toBe(0);

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")
        ->assertOk()
        ->assertJsonPath('data.status', 'published');

    expect(Proposal::find($a['proposal_id'])->status)->toBe('funded')
        ->and((float) Award::where('proposal_id', $a['proposal_id'])->value('awarded_amount'))->toBe(90000.0)
        ->and(Proposal::find($b['proposal_id'])->status)->toBe('accepted')
        ->and(Proposal::find($c['proposal_id'])->status)->toBe('rejected')
        ->and(Proposal::find($c['proposal_id'])->rejection_reason)->toBe('Insufficient funds in this round');

    // A published round can no longer change.
    $put = $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$a['id']}", ['decision' => 'reject', 'reason' => 'Changed my mind'])
        ->assertUnprocessable();
});

test('publishing waits until every proposal has a decision and every rejection a reason', function () {
    $round = rnd_draft($this);

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")->assertUnprocessable();

    foreach ($round['items'] as $item) {
        $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$item['id']}", ['decision' => 'reject'])->assertOk();
    }
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('round');
});

test('funding can never go over the call budget, which can be raised here', function () {
    $round = rnd_draft($this);
    $put = fn ($item, $data) => $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$item['id']}", $data);
    [$a, $b, $c] = $round['items'];

    $put($a, ['decision' => 'fund'])->assertOk();
    $put($b, ['decision' => 'fund'])->assertOk();
    $put($c, ['decision' => 'fund'])->assertUnprocessable()->assertJsonValidationErrors('amount');
    $put($c, ['decision' => 'fund', 'amount' => 50000])->assertOk()->assertJsonPath('data.budget.after', 0);

    // Raising the budget makes room for the full request.
    $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/call/{$this->call->id}/budget", ['funding_budget' => 300000])->assertOk();
    $put($c, ['decision' => 'fund', 'amount' => 100000])->assertOk();

    // Lowering it again below the plans blocks publishing — there is no way to override.
    $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/call/{$this->call->id}/budget", ['funding_budget' => 250000])->assertOk();
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish", ['acknowledge_over_budget' => true])
        ->assertUnprocessable()
        ->assertJsonPath('meta.code', 'over_budget');
    expect(Award::count())->toBe(0);
});

test('the budget cannot be set below what was already awarded from the call', function () {
    $round = rnd_draft($this);
    $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$round['items'][0]['id']}", ['decision' => 'fund']);
    foreach (array_slice($round['items'], 1) as $item) {
        $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$item['id']}", ['decision' => 'reserve']);
    }
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")->assertOk();

    $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/call/{$this->call->id}/budget", ['funding_budget' => 90000])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('funding_budget');
});

test('a reserve proposal can be funded later and carries into the next draft', function () {
    $round = rnd_draft($this);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/auto-fill");
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")->assertOk();
    $reserve = collect(FundingRound::find($round['id'])->items()->get())->firstWhere('decision', 'reserve');

    // The next draft for the call starts with the reserve list as it was.
    $next = rnd_draft($this);
    expect($next['id'])->not->toBe($round['id'])
        ->and($next['items'])->toHaveCount(1)
        ->and($next['items'][0]['decision'])->toBe('reserve');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/funding-rounds/{$round['id']}/items/{$reserve->id}/promote", ['amount' => 50000])
        ->assertOk();

    expect(Proposal::find($reserve->proposal_id)->status)->toBe('funded')
        ->and($reserve->fresh()->promoted_at)->not->toBeNull()
        ->and(rnd_draft($this)['items'])->toHaveCount(0);
});

test('the decision minutes download as a PDF', function () {
    $round = rnd_draft($this);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/auto-fill");
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")->assertOk();

    $res = $this->actingAs($this->central, 'sanctum')->get("/api/v1/funding-rounds/{$round['id']}/minutes")->assertOk();
    expect($res->headers->get('content-type'))->toContain('pdf');
});

test('rounds are for the central office and the call’s own programme director', function () {
    $collegeOfficer = User::factory()->create(['college_id' => $this->college->id]);
    $collegeOfficer->assignRole('college_officer');
    $otherDirector = User::factory()->create();
    $otherDirector->assignRole('community_officer');
    $researchDirector = User::factory()->create();
    $researchDirector->assignRole('research_officer');

    $this->actingAs($collegeOfficer, 'sanctum')->getJson("/api/v1/funding-rounds/call/{$this->call->id}")->assertForbidden();
    $this->actingAs($otherDirector, 'sanctum')->getJson("/api/v1/funding-rounds/call/{$this->call->id}")->assertForbidden();
    $this->actingAs($researchDirector, 'sanctum')->getJson("/api/v1/funding-rounds/call/{$this->call->id}")->assertOk();
});

test('a call without a funding budget gets one here before its round can be published', function () {
    $this->call->update(['funding_budget' => null]);
    $round = rnd_draft($this);
    expect($round['budget']['budget'])->toBeNull();

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/auto-fill")->assertOk();
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('round');

    $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/call/{$this->call->id}/budget", ['funding_budget' => 300000])
        ->assertOk()
        ->assertJsonPath('data.budget.budget', 300000);
    expect((float) $this->call->fresh()->funding_budget)->toBe(300000.0);

    $collegeOfficer = User::factory()->create(['college_id' => $this->college->id]);
    $collegeOfficer->assignRole('college_officer');
    $this->actingAs($collegeOfficer, 'sanctum')->putJson("/api/v1/funding-rounds/call/{$this->call->id}/budget", ['funding_budget' => 1])->assertForbidden();
});

test('a College RTT Manager runs a round for their own college, in every category', function () {
    $manager = User::factory()->create(['college_id' => $this->college->id]);
    $manager->assignRole('college_rtt_manager');

    // Another college's proposal in the same call, and a community engagement call of the manager's college.
    $other = College::create(['name' => 'Other College', 'code' => 'OC'.rand(10000, 99999)]);
    $foreign = rnd_proposal($this, 'accepted', 100000, 'RC-F');
    $foreign->update(['college_id' => $other->id]);
    $community = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'community_engagement', 'title' => 'Community Call 2026', 'slug' => 'cc-'.rand(10000, 99999),
        'start_date' => now()->subMonth(), 'end_date' => now()->subDay(), 'status' => 'active', 'is_open' => false,
        'created_by' => $this->central->id, 'funding_budget' => 100000,
    ]);
    $ce = rnd_proposal($this, 'accepted', 50000, 'CE-1');
    $ce->update(['proposal_call_id' => $community->id, 'category' => 'community_engagement']);

    $calls = $this->actingAs($manager, 'sanctum')->getJson('/api/v1/funding-rounds/calls')->assertOk()->json('data');
    expect(collect($calls)->pluck('id')->all())->toContain($this->call->id, $community->id)
        ->and(collect($calls)->firstWhere('id', $this->call->id)['waiting'])->toBe(3);

    $round = $this->actingAs($manager, 'sanctum')->getJson("/api/v1/funding-rounds/call/{$this->call->id}")->assertOk()->json('data');
    expect($round['items'])->toHaveCount(3)
        ->and($round['college'])->toBe('Round College')
        ->and(collect($round['items'])->pluck('proposal_id'))->not->toContain($foreign->id);
    $this->actingAs($manager, 'sanctum')->getJson("/api/v1/funding-rounds/call/{$community->id}")->assertOk()->assertJsonCount(1, 'data.items');

    // The manager decides one; it then belongs to their round, not the central office's.
    $first = $round['items'][0];
    $this->actingAs($manager, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$first['id']}", ['decision' => 'reserve'])->assertOk();

    $central = rnd_draft($this);
    expect(collect($central['items'])->pluck('proposal_id'))->not->toContain($first['proposal_id'])
        ->toContain($foreign->id)
        ->and($central['can_set_budget'])->toBeTrue();

    // The central round is not the manager's to open.
    $this->actingAs($manager, 'sanctum')->getJson("/api/v1/funding-rounds/{$central['id']}")->assertForbidden();
});

test('a College RTT Manager funds within the share the central office gives their college', function () {
    $manager = User::factory()->create(['college_id' => $this->college->id]);
    $manager->assignRole('college_rtt_manager');
    $as = fn ($user) => $this->actingAs($user, 'sanctum');

    $round = $as($manager)->getJson("/api/v1/funding-rounds/call/{$this->call->id}")->assertOk()->json('data');
    [$a, $b] = $round['items'];
    expect($round['budget']['scope'])->toBe('college')
        ->and($round['budget']['budget'])->toBeNull()
        ->and($round['can_set_budget'])->toBeFalse();

    // No share yet: nothing can be funded, and the manager cannot set budgets.
    $as($manager)->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$a['id']}", ['decision' => 'fund'])->assertUnprocessable()->assertJsonValidationErrors('amount');
    $as($manager)->putJson("/api/v1/funding-rounds/call/{$this->call->id}/budget", ['funding_budget' => 999999])->assertForbidden();
    $as($manager)->putJson("/api/v1/funding-rounds/call/{$this->call->id}/allocations", ['allocations' => []])->assertForbidden();

    // The central office shares the call out; shares cannot add up to more than the call's budget.
    $as($this->central)->putJson("/api/v1/funding-rounds/call/{$this->call->id}/allocations", ['allocations' => [['college_id' => $this->college->id, 'amount' => 300000]]])
        ->assertUnprocessable();
    $as($this->central)->putJson("/api/v1/funding-rounds/call/{$this->call->id}/allocations", ['allocations' => [['college_id' => $this->college->id, 'amount' => 150000]]])
        ->assertOk()
        ->assertJsonPath('data.allocated', 150000)
        ->assertJsonPath('data.unallocated', 100000)
        ->assertJsonPath('data.colleges.0.waiting', 3);
    // ...and the call's total cannot drop below what is shared out.
    $as($this->central)->putJson("/api/v1/funding-rounds/call/{$this->call->id}/budget", ['funding_budget' => 100000])->assertUnprocessable();

    // Within the share it works; beyond it does not.
    $as($manager)->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$a['id']}", ['decision' => 'fund'])->assertOk()
        ->assertJsonPath('data.budget.budget', 150000)
        ->assertJsonPath('data.budget.after', 50000);
    $as($manager)->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$b['id']}", ['decision' => 'fund'])->assertUnprocessable()->assertJsonValidationErrors('amount');
    $as($manager)->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$b['id']}", ['decision' => 'fund', 'amount' => 50000])->assertOk();
    $as($manager)->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$round['items'][2]['id']}", ['decision' => 'reserve'])->assertOk();

    $as($manager)->postJson("/api/v1/funding-rounds/{$round['id']}/publish")->assertOk();
    expect((float) Award::sum('awarded_amount'))->toBe(150000.0);

    // The one-by-one approval holds the manager to the share as well.
    $reserve = Proposal::find($round['items'][2]['proposal_id']);
    $as($manager)->postJson("/api/v1/proposals/{$reserve->id}/central/approve", ['awarded_amount' => 1000])
        ->assertUnprocessable()
        ->assertJsonPath('meta.code', 'over_budget');
});

test('once the budget is used up, funding is refused as insufficient', function () {
    $this->call->update(['funding_budget' => 200000]);
    $round = rnd_draft($this);
    [$a, $b, $c] = $round['items'];
    $put = fn ($item, $data) => $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$round['id']}/items/{$item['id']}", $data);

    $put($a, ['decision' => 'fund'])->assertOk();
    $put($b, ['decision' => 'fund'])->assertOk()->assertJsonPath('data.budget.after', 0);
    $put($c, ['decision' => 'reserve'])->assertOk();
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")->assertOk();

    // The next draft shows the money as used, with nothing remaining.
    $next = rnd_draft($this);
    expect($next['budget']['committed'])->toEqual(200000)
        ->and($next['budget']['after'])->toEqual(0);
    $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/funding-rounds/{$next['id']}/items/{$next['items'][0]['id']}", ['decision' => 'fund'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['amount' => 'Insufficient budget']);

    // The one-by-one approval refuses it too.
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$next['items'][0]['proposal_id']}/central/approve", ['awarded_amount' => 1])
        ->assertUnprocessable()
        ->assertJsonPath('meta.code', 'over_budget');
});

test('funded proposals move to Ongoing Proposals, for the central office and the College RTT Manager', function () {
    $manager = User::factory()->create(['college_id' => $this->college->id]);
    $manager->assignRole('college_rtt_manager');

    $round = rnd_draft($this);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/auto-fill");
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/funding-rounds/{$round['id']}/publish")->assertOk();
    $funded = collect(FundingRound::find($round['id'])->items()->get())->where('decision', 'fund')->pluck('proposal_id')->sort()->values()->all();

    foreach ([$this->central, $manager] as $user) {
        $listed = $this->actingAs($user, 'sanctum')->getJson('/api/v1/ongoing-proposals')->assertOk()->json('data.proposals.data');
        expect(collect($listed)->pluck('id')->sort()->values()->all())->toBe($funded);
    }
});
