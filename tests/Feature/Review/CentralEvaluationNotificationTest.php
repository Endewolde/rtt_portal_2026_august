<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\WorkflowService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

test('passing open defence notifies only the proposal team that it advanced to central evaluation', function () {
    $college = College::create(['name' => 'CE College '.rand(), 'code' => 'CE'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CED'.rand(10, 99)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $collegeOfficer = User::factory()->create(['college_id' => $college->id]);
    $collegeOfficer->assignRole('college_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ce-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $coInvestigator = User::factory()->create();
    $coInvestigator->assignRole('staff');

    $proposal = Proposal::create([
        'tracker_number' => 'CE-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_open_defence',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $coInvestigator->id,
        'role' => 'co_investigator', 'status' => 'active', 'joined_at' => now(),
    ]);

    app(WorkflowService::class)->transition($proposal, 'pass_defence', $central);

    foreach ([$pi, $coInvestigator] as $member) {
        $record = DB::table('notifications')
            ->where('notifiable_id', $member->id)
            ->where('type', 'central_eval_approved')
            ->first();

        expect($record)->not->toBeNull();
        expect(json_decode($record->data, true))
            ->toMatchArray(['proposal_id' => $proposal->id, 'tracker_number' => $proposal->tracker_number]);
    }

    expect(DB::table('notifications')->whereIn('notifiable_id', [$central->id, $collegeOfficer->id])->count())->toBe(0);
});
