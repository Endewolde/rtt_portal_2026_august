<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function badf_makeProposal(): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'BF'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'BFD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'bf-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return [Proposal::create([
        'tracker_number' => 'BF-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'blind_review_passed',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]), $central];
}

function badf_logDecision(Proposal $proposal, User $actor, string $action, ?string $notes, ?array $metadata = null): string
{
    $id = (string) Str::uuid();
    DB::table('workflow_logs')->insert([
        'id' => $id,
        'proposal_id' => $proposal->id,
        'from_stage' => 'under_blind_review',
        'action' => $action,
        'to_stage' => 'blind_review_passed',
        'actor_id' => $actor->id,
        'notes' => $notes,
        'metadata' => $metadata ? json_encode($metadata) : null,
        'created_at' => now(),
    ]);

    return $id;
}

test('dry run reports pre-existing automatic entries without changing them', function () {
    [$proposal, $actor] = badf_makeProposal();
    $id = badf_logDecision($proposal, $actor, 'pass_blind_review', 'Blind review passed. Average score: 74.25/80. Threshold: 60.');

    $exitCode = Artisan::call('workflow-logs:backfill-automatic-flag');
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain('DRY RUN')
        ->and($output)->toContain($proposal->tracker_number);

    $row = DB::table('workflow_logs')->where('id', $id)->first();
    expect($row->metadata)->toBeNull();
});

test('--force tags a pre-existing automatic blind-review entry', function () {
    [$proposal, $actor] = badf_makeProposal();
    $id = badf_logDecision($proposal, $actor, 'pass_blind_review', 'Blind review passed. Average score: 74.25/80. Threshold: 60.');

    Artisan::call('workflow-logs:backfill-automatic-flag', ['--force' => true]);

    $row = DB::table('workflow_logs')->where('id', $id)->first();
    expect(json_decode($row->metadata, true)['automatic'])->toBeTrue();
});

test('--force tags a pre-existing automatic defence entry', function () {
    [$proposal, $actor] = badf_makeProposal();
    $id = badf_logDecision($proposal, $actor, 'fail_defence', 'Defence failed automatically. Blind: 64.33/80, Defence: 4/20. Combined: 68.33/100. Combined threshold: 70.');

    Artisan::call('workflow-logs:backfill-automatic-flag', ['--force' => true]);

    $row = DB::table('workflow_logs')->where('id', $id)->first();
    expect(json_decode($row->metadata, true)['automatic'])->toBeTrue();
});

test('--force does not touch a manual entry', function () {
    [$proposal, $actor] = badf_makeProposal();
    $id = badf_logDecision($proposal, $actor, 'fail_blind_review', 'Rejected — duplicate submission detected during review.');

    Artisan::call('workflow-logs:backfill-automatic-flag', ['--force' => true]);

    $row = DB::table('workflow_logs')->where('id', $id)->first();
    expect($row->metadata)->toBeNull();
});

test('--force preserves existing metadata keys when adding the flag', function () {
    [$proposal, $actor] = badf_makeProposal();
    $id = badf_logDecision($proposal, $actor, 'pass_blind_review', 'Blind review passed. Average score: 74.25/80. Threshold: 60.', ['average_score' => 74.25, 'threshold' => 60]);

    Artisan::call('workflow-logs:backfill-automatic-flag', ['--force' => true]);

    $row = DB::table('workflow_logs')->where('id', $id)->first();
    $metadata = json_decode($row->metadata, true);
    expect($metadata['automatic'])->toBeTrue()
        ->and($metadata['average_score'])->toBe(74.25);
});

test('an entry already flagged automatic is skipped and not reported again', function () {
    [$proposal, $actor] = badf_makeProposal();
    badf_logDecision($proposal, $actor, 'pass_blind_review', 'Blind review passed. Average score: 74.25/80. Threshold: 60.', ['automatic' => true]);

    $exitCode = Artisan::call('workflow-logs:backfill-automatic-flag');
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain('No pre-existing automatic-decision log entries need backfilling.');
});
