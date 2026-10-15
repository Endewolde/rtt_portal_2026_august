<?php

use App\Models\College;
use App\Models\DefenceSession;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Services\DefenceRecordService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->pi = User::factory()->create(['name' => 'Hana Tesfaye', 'title' => 'Dr.']);
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'dr-'.rand(10000, 99999),
        'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->proposal = Proposal::create([
        'tracker_number' => 'RES-DR-'.rand(10000, 99999), 'proposal_call_id' => $call->id, 'pi_user_id' => $this->pi->id,
        'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'Water Quality Study', 'status' => 'under_open_defence',
        'category' => 'research', 'academic_year' => '2026', 'created_by' => $this->pi->id,
    ]);
});

test('the record lists the session, the panel and the outcome', function () {
    DefenceSession::create(['proposal_id' => $this->proposal->id, 'scheduled_date' => now()->toDateString(), 'scheduled_time' => '10:00',
        'venue' => 'Senate Hall', 'status' => 'scheduled', 'scheduled_by' => $this->central->id]);
    $type = EvaluationType::create(['name' => 'open_defence_dr', 'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true]);
    $panelist = User::factory()->create(['name' => 'Kebede Alemu']);
    ReviewAssignment::create(['proposal_id' => $this->proposal->id, 'reviewer_id' => $panelist->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $this->central->id, 'status' => 'pending', 'assigned_at' => now()]);

    $data = app(DefenceRecordService::class)->data($this->proposal);

    expect($data['session']->venue)->toBe('Senate Hall')
        ->and($data['pi'])->toBe('Dr. Hana Tesfaye')
        ->and($data['panel'][0]['name'])->toBe('Kebede Alemu')
        ->and($data['panel'][0]['submitted'])->toBeFalse();

    $this->actingAs($this->central, 'sanctum')->get("/api/v1/proposals/{$this->proposal->id}/defence-record")
        ->assertOk()->assertHeader('content-type', 'application/pdf');
});

test('no record before a defence is scheduled, and only officers can download it', function () {
    $this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/defence-record")->assertNotFound();
    $this->actingAs($this->pi, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/defence-record")->assertForbidden();
});
