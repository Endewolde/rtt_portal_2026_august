<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::create(['name' => 'C'.rand(), 'code' => 'RX'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RXD'.rand(10000, 99999)]);
    $this->otherDept = Department::create(['college_id' => $college->id, 'name' => 'E', 'code' => 'RXE'.rand(10000, 99999)]);
    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'rx-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->make = function (User $pi, string $status = 'validated', array $members = []) use ($college) {
        $p = Proposal::create([
            'tracker_number' => 'RX-'.rand(100000, 999999), 'proposal_call_id' => $this->call->id, 'category' => 'research',
            'title' => 'P', 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
            'department_id' => $this->dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
        ]);
        foreach ($members as $m) {
            ProposalMember::create(['proposal_id' => $p->id, 'user_id' => $m->id, 'role' => 'co_investigator', 'status' => 'active', 'joined_at' => now()]);
        }

        return $p;
    };
    $this->reviewer = fn (?Department $dept = null) => tap(User::factory()->create(['department_id' => ($dept ?? $this->otherDept)->id, 'status' => 'active']))->assignRole('staff');
    $this->blind = EvaluationType::create(['name' => 'blind_review_rx', 'label' => 'B', 'proposal_category' => 'research', 'is_active' => true]);
    $this->assign = fn (Proposal $p, User $r, bool $ack = false) => $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$p->id}/review/assign", [
        'reviewer_ids' => [$r->id], 'evaluation_type_id' => $this->blind->id, 'due_date' => now()->addWeek()->toDateString(), 'acknowledge_conflicts' => $ack,
    ]);
});

test('a reviewer from the proposal\'s department is flagged in the reviewer list', function () {
    $pi = ($this->reviewer)();
    $proposal = ($this->make)($pi);
    $colleague = ($this->reviewer)($this->dept);
    $outsider = ($this->reviewer)();

    $list = collect($this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/available-reviewers?search=a")->json('data'))
        ->merge($this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/available-reviewers?search=e")->json('data'))
        ->keyBy('id');

    expect($list[$colleague->id]['conflicts'] ?? null)->toBe(['Same department as the proposal'])
        ->and($list[$outsider->id]['conflicts'] ?? [])->toBe([]);
});

test('blind review refuses a flagged reviewer until the officer confirms, and records the confirmation', function () {
    $pi = ($this->reviewer)();
    $coAuthor = ($this->reviewer)();
    ($this->make)($pi, 'funded', [$coAuthor]);           // worked together before
    $proposal = ($this->make)($pi);

    ($this->assign)($proposal, $coAuthor)->assertStatus(422)->assertJsonPath('message', fn ($m) => str_starts_with($m, 'Possible conflict of interest'));
    expect(ReviewAssignment::count())->toBe(0);

    ($this->assign)($proposal, $coAuthor, true)->assertCreated();
    expect(ReviewAssignment::first()->acknowledged_conflicts[0])->toStartWith('Worked with the research team on');
});

test('a reviewer without any conflict is assigned straight away', function () {
    $proposal = ($this->make)(($this->reviewer)());

    ($this->assign)($proposal, ($this->reviewer)())->assertCreated();
    expect(ReviewAssignment::first()->acknowledged_conflicts)->toBeNull();
});

test('suggestions never include a co-investigator of the proposal', function () {
    $pi = ($this->reviewer)();
    $coInvestigator = ($this->reviewer)();
    $coInvestigator->update(['expertise' => ['soil science']]);
    $proposal = ($this->make)($pi, 'validated', [$coInvestigator]);
    $proposal->update(['keywords' => 'soil science']);

    $ids = collect($this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/reviewer-suggestions")->json('data'))->pluck('id');

    expect($ids)->not->toContain($coInvestigator->id);
});
