<?php

use App\Models\Award;
use App\Models\College;
use App\Models\Department;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ProgressReportService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    $this->college = College::create(['name' => 'Own '.rand(), 'code' => 'RM'.rand(10000, 99999)]);
    $this->otherCollege = College::create(['name' => 'Other '.rand(), 'code' => 'RO'.rand(10000, 99999)]);

    $this->manager = User::factory()->create(['college_id' => $this->college->id]);
    $this->manager->assignRole('college_rtt_manager');

    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'rm-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);

    $this->makeProposal = function (College $college, string $status, string $category = 'research'): Proposal {
        $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RD'.rand(100000, 999999)]);
        $pi = User::factory()->create(['college_id' => $college->id]);
        $pi->assignRole('staff');

        return Proposal::create([
            'tracker_number' => 'RM-'.rand(100000, 999999), 'proposal_call_id' => $this->call->id, 'category' => $category,
            'title' => 'P', 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
        ]);
    };
});

test('sees every category of their own college\'s proposals, and nothing from other colleges', function () {
    $research = ($this->makeProposal)($this->college, 'submitted', 'research');
    $community = ($this->makeProposal)($this->college, 'funded', 'community_engagement');
    ($this->makeProposal)($this->otherCollege, 'submitted');

    $ids = collect($this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/proposals?per_page=50')->assertOk()->json('data.data'))->pluck('id');

    expect($ids->sort()->values()->all())->toBe(collect([$research->id, $community->id])->sort()->values()->all());
});

test('central evaluation lists and decides only their own college\'s proposals', function () {
    $own = ($this->makeProposal)($this->college, 'accepted', 'technology_transfer');
    $other = ($this->makeProposal)($this->otherCollege, 'accepted');

    $listed = collect($this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/central-evaluation')->assertOk()->json('data'))->pluck('id');
    expect($listed->all())->toBe([$own->id]);

    $this->actingAs($this->manager, 'sanctum')
        ->postJson("/api/v1/proposals/{$own->id}/central/approve", ['awarded_amount' => 120000])
        ->assertOk();
    expect($own->fresh()->status)->toBe('funded')
        ->and((float) Award::where('proposal_id', $own->id)->value('awarded_amount'))->toBe(120000.0);

    $this->actingAs($this->manager, 'sanctum')
        ->postJson("/api/v1/proposals/{$other->id}/central/approve", ['awarded_amount' => 120000])
        ->assertForbidden();
    $this->actingAs($this->manager, 'sanctum')
        ->postJson("/api/v1/proposals/{$other->id}/central/reject", ['reason' => 'Out of scope for this college office.'])
        ->assertForbidden();
    expect($other->fresh()->status)->toBe('accepted');
});

test('can reject in central evaluation, adjust the award and revoke funding for their college only', function () {
    $toReject = ($this->makeProposal)($this->college, 'accepted');
    $this->actingAs($this->manager, 'sanctum')
        ->postJson("/api/v1/proposals/{$toReject->id}/central/reject", ['reason' => 'Does not fit the college priorities this year.'])
        ->assertOk();
    expect($toReject->fresh()->status)->toBe('rejected');

    $funded = ($this->makeProposal)($this->college, 'accepted');
    $this->actingAs($this->manager, 'sanctum')->postJson("/api/v1/proposals/{$funded->id}/central/approve", ['awarded_amount' => 50000])->assertOk();
    $this->actingAs($this->manager, 'sanctum')->patchJson("/api/v1/proposals/{$funded->id}/award", ['awarded_amount' => 60000])->assertOk();
    $this->actingAs($this->manager, 'sanctum')
        ->postJson("/api/v1/proposals/{$funded->id}/funding/revoke", ['reason' => 'The PI left the university before starting.'])
        ->assertOk();
    expect($funded->fresh()->status)->toBe('rejected');

    $otherFunded = ($this->makeProposal)($this->otherCollege, 'accepted');
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$otherFunded->id}/central/approve", ['awarded_amount' => 50000])->assertOk();
    $this->actingAs($this->manager, 'sanctum')->patchJson("/api/v1/proposals/{$otherFunded->id}/award", ['awarded_amount' => 1])->assertForbidden();
    $this->actingAs($this->manager, 'sanctum')
        ->postJson("/api/v1/proposals/{$otherFunded->id}/funding/revoke", ['reason' => 'Trying to revoke another college.'])
        ->assertForbidden();
    expect($otherFunded->fresh()->status)->toBe('funded');
});

test('a category director can no longer decide another category\'s proposal', function () {
    $technology = ($this->makeProposal)($this->college, 'accepted', 'technology_transfer');
    $researchDirector = User::factory()->create();
    $researchDirector->assignRole('research_officer');

    $this->actingAs($researchDirector, 'sanctum')
        ->postJson("/api/v1/proposals/{$technology->id}/central/approve", ['awarded_amount' => 1000])
        ->assertForbidden();
    expect($technology->fresh()->status)->toBe('accepted');
});

test('reviews progress reports, the pipeline and reports for their own college only', function () {
    $own = ($this->makeProposal)($this->college, 'funded');
    $other = ($this->makeProposal)($this->otherCollege, 'funded');
    $access = app(ProgressReportService::class);

    expect($access->canReview($own, $this->manager))->toBeTrue()
        ->and($access->canReview($other, $this->manager))->toBeFalse();

    $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/progress-reports')->assertOk();

    $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/proposal-pipeline')
        ->assertOk()
        ->assertJsonCount(1, 'data.colleges')
        ->assertJsonPath('data.colleges.0.id', $this->college->id);

    $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/reports/builder-options')->assertOk();
    $this->actingAs($this->manager, 'sanctum')->get('/api/v1/reports/proposals/export')->assertOk();
});

test('the role needs a college: it can\'t be given to someone without one', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $noCollege = User::factory()->create(['college_id' => null]);

    $this->actingAs($superAdmin, 'sanctum')
        ->putJson("/api/v1/users/{$noCollege->id}/roles", ['roles' => ['college_rtt_manager']])
        ->assertStatus(422)
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'set the user\'s college first'));

    $noCollege->update(['college_id' => $this->college->id]);
    $this->actingAs($superAdmin, 'sanctum')
        ->putJson("/api/v1/users/{$noCollege->id}/roles", ['roles' => ['college_rtt_manager']])
        ->assertOk();
    expect($noCollege->fresh()->hasRole('college_rtt_manager'))->toBeTrue();
});

test('monitoring and budget lists show their own college, read-only', function () {
    $own = ($this->makeProposal)($this->college, 'midterm_evaluation');
    $other = ($this->makeProposal)($this->otherCollege, 'midterm_evaluation');
    foreach ([$own, $other] as $p) {
        MidtermEvaluation::create([
            'proposal_id' => $p->id, 'evaluation_date' => now()->toDateString(), 'status' => 'scheduled', 'scheduled_by' => $this->central->id,
        ]);
    }

    $midterms = collect($this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/midterm-evaluations')->assertOk()->json('data'))
        ->pluck('proposal_id');
    expect($midterms->all())->toBe([$own->id]);

    $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/budget-allocations')->assertOk();
    $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/budget-requests')->assertOk();
    $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/completion-workshops')->assertOk();
    $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/research-outputs')->assertOk();
});

test('the proposal list can include awards and honours per_page, so funding pages need one request', function () {
    foreach (range(1, 22) as $i) {
        $p = ($this->makeProposal)($this->college, 'accepted');
        $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$p->id}/central/approve", ['awarded_amount' => 1000 * $i])->assertOk();
    }

    $page = $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/proposals?status=funded&per_page=200&with_award=1')->assertOk()->json('data');

    expect($page['data'])->toHaveCount(22)
        ->and(collect($page['data'])->pluck('award.awarded_amount')->filter()->count())->toBe(22);
});
