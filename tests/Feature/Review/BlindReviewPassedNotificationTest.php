<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
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

test('passing blind review notifies the officers who can schedule an open defence session', function () {
    $college = College::create(['name' => 'BRP College '.rand(), 'code' => 'BR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'BRD'.rand(10000, 99999)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $collegeOfficer = User::factory()->create(['college_id' => $college->id]);
    $collegeOfficer->assignRole('college_officer');

    // A college officer at a different college must NOT be notified.
    $otherCollege = College::create(['name' => 'BRP College B '.rand(), 'code' => 'BRB'.rand(10000, 99999)]);
    $otherCollegeOfficer = User::factory()->create(['college_id' => $otherCollege->id]);
    $otherCollegeOfficer->assignRole('college_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'brp-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $proposal = Proposal::create([
        'tracker_number' => 'BRP-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_blind_review',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    app(WorkflowService::class)->transition($proposal, 'pass_blind_review', $central);

    foreach ([$central, $researchOfficer, $collegeOfficer] as $recipient) {
        $record = DB::table('notifications')
            ->where('notifiable_id', $recipient->id)
            ->where('type', 'blind_review_passed_officer')
            ->first();

        expect($record)->not->toBeNull();
    }

    $notNotified = DB::table('notifications')
        ->where('notifiable_id', $otherCollegeOfficer->id)
        ->where('type', 'blind_review_passed_officer')
        ->first();

    expect($notNotified)->toBeNull();
});
