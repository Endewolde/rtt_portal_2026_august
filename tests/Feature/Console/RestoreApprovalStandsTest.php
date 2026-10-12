<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalApprovalReport;
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
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
});

/**
 * Reproduces the production state: the report pulled the proposal from $from back to
 * validated, then the old "Approval Stands" only marked the report reviewed.
 */
function ras_stuck(object $ctx, string $from): array
{
    $college = College::create(['name' => 'C'.rand(), 'code' => 'RS'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RSD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'rs-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $ctx->central->id,
    ]);
    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $proposal = Proposal::create([
        'tracker_number' => 'RS-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'validated', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $reportedAt = now()->subDays(3);
    $report = ProposalApprovalReport::create([
        'proposal_id' => $proposal->id, 'reported_by' => $officer->id, 'reason' => 'Looks like a duplicate.',
        'status' => 'reviewed', 'reviewed_by' => $ctx->central->id, 'reviewed_at' => now()->subDays(2),
        'resolution_notes' => 'Reviewed — approval stands.',
    ]);
    $report->forceFill(['created_at' => $reportedAt])->save();

    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id, 'from_stage' => $from,
        'action' => 'return_for_investigation', 'to_stage' => 'validated', 'actor_id' => $officer->id,
        'notes' => 'Looks like a duplicate.', 'metadata' => null, 'created_at' => $reportedAt,
    ]);

    return [$proposal, $report];
}

test('the audit lists a proposal left at validated after an approval-stands decision, without changing it', function () {
    [$proposal] = ras_stuck($this, 'blind_review_passed');

    Artisan::call('reports:audit-stuck-approvals');
    $output = Artisan::output();

    expect($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('blind_review_passed')
        ->and($proposal->fresh()->status)->toBe('validated');
});

test('the restore command is a dry run by default', function () {
    [$proposal] = ras_stuck($this, 'blind_review_passed');

    Artisan::call('reports:restore-approval-stands');

    expect(Artisan::output())->toContain('DRY RUN')
        ->and($proposal->fresh()->status)->toBe('validated');
});

test('--force returns a proposal that had passed blind review to Blind Review Passed', function () {
    [$proposal, $report] = ras_stuck($this, 'blind_review_passed');

    Artisan::call('reports:restore-approval-stands', ['--force' => true]);

    expect($proposal->fresh()->status)->toBe('blind_review_passed')
        ->and($report->fresh()->outcome)->toBe('approval_stands')
        ->and(DB::table('workflow_logs')->where('proposal_id', $proposal->id)->where('action', 'withdraw_report_restore_passed')->exists())->toBeTrue();

    Artisan::call('reports:audit-stuck-approvals');
    expect(Artisan::output())->toContain('No stuck proposals');
});

test('--force returns a proposal pulled out of blind review to Under Blind Review', function () {
    [$proposal] = ras_stuck($this, 'under_blind_review');

    Artisan::call('reports:restore-approval-stands', ['--force' => true]);

    expect($proposal->fresh()->status)->toBe('under_blind_review');
});

test('a proposal someone acted on since the report is reported, never restored', function () {
    [$proposal] = ras_stuck($this, 'blind_review_passed');
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id, 'from_stage' => 'validated',
        'action' => 'assign_for_review', 'to_stage' => 'under_blind_review', 'actor_id' => $this->central->id,
        'notes' => null, 'metadata' => null, 'created_at' => now()->subDay(),
    ]);
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id, 'from_stage' => 'under_blind_review',
        'action' => 'unassign_reviewers', 'to_stage' => 'validated', 'actor_id' => $this->central->id,
        'notes' => null, 'metadata' => null, 'created_at' => now()->subHours(12),
    ]);

    Artisan::call('reports:restore-approval-stands', ['--force' => true]);

    expect(Artisan::output())->toContain('manual review')
        ->and($proposal->fresh()->status)->toBe('validated');
});

test('a report confirmed as a mistaken approval is never touched', function () {
    [$proposal, $report] = ras_stuck($this, 'blind_review_passed');
    $report->update(['outcome' => 'approval_revoked']);

    Artisan::call('reports:restore-approval-stands', ['--force' => true]);

    expect(Artisan::output())->toContain('Nothing to restore')
        ->and($proposal->fresh()->status)->toBe('validated');
});
