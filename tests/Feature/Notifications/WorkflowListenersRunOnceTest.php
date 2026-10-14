<?php

use App\Events\ProposalTransitioned;
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
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

test('each workflow listener is registered exactly once', function () {
    $listeners = collect(Event::getRawListeners()[ProposalTransitioned::class] ?? [])
        ->map(fn ($l) => is_string($l) ? explode('@', $l)[0] : 'closure')
        ->countBy();

    expect($listeners->filter(fn ($n) => $n > 1)->all())->toBe([]);
});

test('a workflow decision notifies the PI once, not twice', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $college = College::create(['name' => 'C'.rand(), 'code' => 'WL'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'WLD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'wl-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);
    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $proposal = Proposal::create([
        'tracker_number' => 'WL-1', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'P',
        'status' => 'submitted', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    app(WorkflowService::class)->transition($proposal, 'validate', $central);

    expect(DB::table('notifications')->where('notifiable_id', $pi->id)->where('type', 'decision_result')->count())->toBe(1);
});
