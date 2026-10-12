<?php

use App\Models\AppSetting;
use App\Models\College;
use App\Models\CompletionWorkshop;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalClosureChecklist;
use App\Models\User;
use App\Services\CompletionWorkshopService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Queue::fake();
});

function cc_proposal(): array
{
    $college = College::create(['name' => 'CC College '.rand(), 'code' => 'CC'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CC'.rand(10, 99)]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $admin = User::factory()->create();
    $call = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => 'research',
        'title' => 'Test Call', 'slug' => 'cc-call-'.rand(10000, 99999),
        'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'id' => (string) Str::uuid(),
        'tracker_number' => 'RTT-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'title' => 'Test Proposal',
        'abstract' => 'Test abstract content.',
        'status' => 'midterm_evaluation',
        'category' => 'research',
        'academic_year' => '2024/25',
        'created_by' => $pi->id,
        'duration_months' => 12,
    ]);

    return [$pi, $proposal];
}

function cc_workshop(Proposal $proposal): CompletionWorkshop
{
    return CompletionWorkshop::create([
        'proposal_id' => $proposal->id,
        'scheduled_date' => now()->subDays(3),
        'scheduled_time' => '10:00:00',
        'venue' => 'Main Hall',
        'status' => 'scheduled',
        'scheduled_by' => $proposal->pi_user_id,
    ]);
}

function setSubFeatureEnabled(string $slug, bool $enabled): void
{
    $stored = AppSetting::where('key', 'disabled_sub_features')->value('value');
    $disabled = $stored ? json_decode($stored, true) : [
        'workflow.co_pi_acceptance', 'workflow.coi_declaration', 'workflow.budget_revision',
        'workflow.no_cost_extension', 'workflow.sla_tracking', 'workflow.ethical_clearance',
        'workflow.proposal_templates', 'workflow.closure_checklist',
    ];

    $disabled = $enabled
        ? array_values(array_diff($disabled, [$slug]))
        : array_values(array_unique([...$disabled, $slug]));

    AppSetting::updateOrCreate(['key' => 'disabled_sub_features'], ['value' => json_encode($disabled)]);
    Cache::forget('global:disabled_sub_features');
}

// ─── show()/update() ───────────────────────────────────────────────────────────

test('an officer can view a proposal\'s closure checklist, auto-created with all items unchecked', function () {
    [, $proposal] = cc_proposal();
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $response = $this->actingAs($officer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/closure-checklist")
        ->assertOk();

    expect($response->json('data.is_complete'))->toBeFalse()
        ->and($response->json('data.items.final_report_submitted'))->toBeFalse();
});

test('a reviewer cannot view a closure checklist', function () {
    [, $proposal] = cc_proposal();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/closure-checklist")
        ->assertStatus(403);
});

test('an officer can toggle a checklist item', function () {
    [, $proposal] = cc_proposal();
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $response = $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/closure-checklist", [
            'key' => 'final_report_submitted',
            'checked' => true,
        ])
        ->assertOk();

    expect($response->json('data.items.final_report_submitted'))->toBeTrue()
        ->and($response->json('data.is_complete'))->toBeFalse();
});

test('the checklist is complete only once every item is checked', function () {
    [, $proposal] = cc_proposal();
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    foreach (ProposalClosureChecklist::ITEM_KEYS as $key) {
        $this->actingAs($officer, 'sanctum')
            ->postJson("/api/v1/proposals/{$proposal->id}/closure-checklist", ['key' => $key, 'checked' => true])
            ->assertOk();
    }

    $response = $this->actingAs($officer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/closure-checklist")
        ->assertOk();

    expect($response->json('data.is_complete'))->toBeTrue();
});

test('an unrecognized checklist key is rejected', function () {
    [, $proposal] = cc_proposal();
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/closure-checklist", [
            'key' => 'not_a_real_item',
            'checked' => true,
        ])
        ->assertStatus(422);
});

// ─── Enforcement in CompletionWorkshopService::finalizeWorkshop() ─────────────

test('finalizing a workshop is blocked when the closure checklist feature is on but incomplete', function () {
    setSubFeatureEnabled('workflow.closure_checklist', true);
    [, $proposal] = cc_proposal();
    $workshop = cc_workshop($proposal);
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    expect(fn () => app(CompletionWorkshopService::class)->finalizeWorkshop($workshop, 85.0, $officer))
        ->toThrow(Exception::class, 'closure checklist must be fully confirmed');
});

test('finalizing a workshop succeeds once the closure checklist is complete', function () {
    setSubFeatureEnabled('workflow.closure_checklist', true);
    [, $proposal] = cc_proposal();
    $workshop = cc_workshop($proposal);
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    ProposalClosureChecklist::create([
        'proposal_id' => $proposal->id,
        'items' => array_fill_keys(ProposalClosureChecklist::ITEM_KEYS, true),
    ]);

    $completed = app(CompletionWorkshopService::class)->finalizeWorkshop($workshop, 85.0, $officer);

    expect($completed->status)->toBe('completed');
});

test('finalizing a workshop is not blocked when the closure checklist feature is off', function () {
    [, $proposal] = cc_proposal();
    $workshop = cc_workshop($proposal);
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $completed = app(CompletionWorkshopService::class)->finalizeWorkshop($workshop, 85.0, $officer);

    expect($completed->status)->toBe('completed');
});

test('the closure checklist gate applies even to a super_admin finalizing the workshop', function () {
    setSubFeatureEnabled('workflow.closure_checklist', true);
    [, $proposal] = cc_proposal();
    $workshop = cc_workshop($proposal);
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    expect(fn () => app(CompletionWorkshopService::class)->finalizeWorkshop($workshop, 85.0, $superAdmin))
        ->toThrow(Exception::class, 'closure checklist must be fully confirmed');
});
