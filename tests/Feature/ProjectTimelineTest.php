<?php

use App\Models\Award;
use App\Models\BudgetMilestone;
use App\Models\College;
use App\Models\Department;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->pi = User::factory()->create(['status' => 'active']);
    $this->pi->assignRole('staff');
    $college = College::create(['name' => 'PT '.rand(), 'code' => 'PT'.rand(10000, 99999), 'status' => 'active']);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'PTD'.rand(10000, 99999)]);
    $call = ProposalCall::create(['academic_year' => '2025-2026', 'category' => 'research', 'title' => 'C', 'slug' => 'pt-'.rand(1000, 9999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->pi->id]);
    $this->project = Proposal::create(['tracker_number' => 'PT-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'Groundwater',
        'status' => 'funded', 'pi_user_id' => $this->pi->id, 'college_id' => $college->id, 'department_id' => $dept->id, 'academic_year' => '2025-2026',
        'created_by' => $this->pi->id, 'duration_months' => 12]);
    Award::create(['proposal_id' => $this->project->id, 'grant_reference' => 'WSU/R/1', 'approved_by' => $this->pi->id, 'approved_at' => now()->subMonths(4)]);
});

test('the project team sees every dated step marked done, overdue, due soon or later', function () {
    BudgetMilestone::create(['proposal_id' => $this->project->id, 'title' => 'Field survey', 'amount' => 20000, 'due_date' => now()->subDays(5), 'sort_order' => 1]);
    BudgetMilestone::create(['proposal_id' => $this->project->id, 'title' => 'Lab analysis', 'amount' => 10000, 'due_date' => now()->addDays(10), 'sort_order' => 2]);
    ProgressReport::create(['proposal_id' => $this->project->id, 'period_number' => 1, 'period_start' => now()->subMonths(3), 'period_end' => now()->subMonth(),
        'due_date' => now()->subMonth(), 'status' => 'accepted', 'submitted_at' => now()->subMonth()]);

    $data = $this->actingAs($this->pi, 'sanctum')->getJson("/api/v1/projects/{$this->project->id}/timeline")->assertOk()->json('data');
    $items = collect($data['items'])->keyBy('label');

    expect($items['Field survey']['state'])->toBe('overdue')
        ->and($items['Lab analysis']['state'])->toBe('due')
        ->and($items['Progress report 1']['state'])->toBe('done')
        ->and($items['Planned end']['state'])->toBe('later')
        ->and($data['summary']['overdue'])->toBe(1);
});

test('someone outside the project cannot open its timeline', function () {
    $stranger = User::factory()->create(['status' => 'active']);
    $stranger->assignRole('staff');

    $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/projects/{$this->project->id}/timeline")->assertNotFound();
});
