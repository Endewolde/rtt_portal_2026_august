<?php

use App\Models\Award;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Support\Sdg;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->college = College::create(['name' => 'Goal College', 'code' => 'GC'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'GD'.rand(10000, 99999)]);
    $this->call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'gc-'.rand(10000, 99999),
        'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);

    $this->make = function (array $sdgs, string $status = 'submitted', ?float $awarded = null) {
        $pi = User::factory()->create();
        $proposal = Proposal::create([
            'tracker_number' => 'GC-'.rand(100000, 999999), 'proposal_call_id' => $this->call->id, 'category' => 'research',
            'title' => 'Goal '.rand(), 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $this->college->id,
            'department_id' => $this->dept->id, 'academic_year' => '2026-2027', 'created_by' => $pi->id, 'sdgs' => $sdgs,
        ]);
        if ($awarded) {
            Award::create(['proposal_id' => $proposal->id, 'grant_reference' => 'G-'.rand(), 'approved_by' => $this->central->id, 'approved_at' => now(), 'awarded_amount' => $awarded]);
        }

        return $proposal;
    };
});

test('goals are kept as up to three valid, unique numbers', function () {
    expect(Sdg::clean([2, '2', 13, 99, 0, 6, 3]))->toBe([2, 13, 6])
        ->and(Sdg::clean('nonsense'))->toBe([]);
});

test('a researcher saves the goals in the first step of the proposal form', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $draft = Proposal::create([
        'tracker_number' => 'GC-DRAFT', 'proposal_call_id' => $this->call->id, 'category' => 'research', 'title' => 'Draft',
        'status' => 'draft', 'pi_user_id' => $pi->id, 'college_id' => $this->college->id, 'department_id' => $this->dept->id,
        'academic_year' => '2026-2027', 'created_by' => $pi->id,
    ]);

    $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$draft->id}/steps/1", [
        'title' => 'Draft', 'abstract' => str_repeat('a', 120), 'focus_area' => 'Agriculture', 'duration_months' => 12,
        'research_type' => 'Applied Research', 'sdgs' => [2, 15, 15, 40, 13, 1],
    ])->assertOk();

    expect($draft->fresh()->sdgs)->toBe([2, 15, 13]);
    $this->getJson("/api/v1/proposals/{$draft->id}")->assertJsonPath('data.sdgs', [2, 15, 13]);
});

test('the SDG alignment report counts proposals, funded projects and money per goal', function () {
    ($this->make)([2, 13], 'funded', 100000);
    ($this->make)([2], 'submitted');
    ($this->make)([5], 'draft');

    $rows = collect($this->actingAs($this->central, 'sanctum')->getJson('/api/v1/reports/live/sdg_alignment?fresh=1')->assertOk()->json('data'))->keyBy('sdg');

    expect($rows)->toHaveCount(17)
        ->and($rows[2]['proposals'])->toBe(2)
        ->and($rows[2]['funded'])->toBe(1)
        ->and((float) $rows[13]['awarded'])->toBe(100000.0)
        ->and($rows[5]['proposals'])->toBe(0);
});

test('the proposal list filters by goal', function () {
    $hunger = ($this->make)([2]);
    ($this->make)([13]);

    $ids = collect($this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposals?sdg=2')->json('data.data'))->pluck('id')->all();

    expect($ids)->toBe([$hunger->id]);
});
