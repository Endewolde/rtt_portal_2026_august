<?php

use App\Exceptions\WorkflowGuardException;
use App\Models\College;
use App\Models\Department;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\ProposalService;
use App\Services\SubmissionEligibilityService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $this->pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $this->pi->assignRole('staff');
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'se-'.rand(10000, 99999),
        'start_date' => now()->subDay()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->pi->id,
    ]);
    $base = ['proposal_call_id' => $call->id, 'pi_user_id' => $this->pi->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'title' => 'P', 'abstract' => 'An abstract.', 'category' => 'research', 'academic_year' => '2026', 'created_by' => $this->pi->id];

    $this->funded = Proposal::create($base + ['tracker_number' => 'RES-OLD-'.rand(1000, 9999), 'status' => 'funded']);
    $this->draft = Proposal::create($base + ['tracker_number' => 'DRAFT-'.rand(10000, 99999), 'status' => 'draft']);
    ProposalMember::create(['proposal_id' => $this->draft->id, 'user_id' => User::factory()->create()->id, 'role' => 'co_investigator', 'status' => 'active', 'invitation_status' => 'accepted', 'joined_at' => now()]);
    ProposalBudget::create(['proposal_id' => $this->draft->id, 'category' => 'equipment', 'item_description' => 'Kit', 'amount' => 100]);
    ProposalDocument::create(['proposal_id' => $this->draft->id, 'document_type' => 'proposal', 'version' => 1, 'is_current' => true,
        'original_filename' => 'p.pdf', 'stored_path' => 'x/p.pdf', 'file_size' => 10, 'mime_type' => 'application/pdf', 'uploaded_by' => $this->pi->id]);

    $this->overdue = fn () => ProgressReport::create(['proposal_id' => $this->funded->id, 'period_number' => 1, 'period_start' => now()->subMonths(4),
        'period_end' => now()->subMonth(), 'due_date' => now()->subDays(10), 'is_final' => false, 'status' => ProgressReport::STATUS_DUE]);
});

function se_setting(string $key, string $value): void
{
    DB::table('app_settings')->updateOrInsert(['key' => $key], ['id' => (string) Str::uuid(), 'value' => $value, 'type' => 'string', 'group' => 'thresholds']);
}

test('an overdue progress report holds back a new submission, and says why', function () {
    ($this->overdue)();

    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/submission-eligibility')
        ->assertJsonPath('data.eligible', false)
        ->assertJsonPath('data.reasons.0.type', 'overdue_report')
        ->assertJsonPath('data.reasons.0.proposal_id', $this->funded->id);

    expect(fn () => app(ProposalService::class)->submit($this->draft, $this->pi))
        ->toThrow(WorkflowGuardException::class, 'progress report #1');
    expect($this->draft->fresh()->status)->toBe('draft');
});

test('with the rule switched off, the same PI can submit', function () {
    ($this->overdue)();
    se_setting('eligibility_block_overdue_reports', 'false');

    expect(app(ProposalService::class)->submit($this->draft, $this->pi)->status)->toBe('submitted');
});

test('the active-grant cap applies only when set', function () {
    expect(app(SubmissionEligibilityService::class)->check($this->pi)['eligible'])->toBeTrue();

    se_setting('eligibility_max_active_grants', '1');

    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/submission-eligibility')
        ->assertJsonPath('data.eligible', false)
        ->assertJsonPath('data.reasons.0.type', 'active_grants');
});

test('a proposal returned for corrections can always be resubmitted', function () {
    ($this->overdue)();
    $this->draft->update(['tracker_number' => 'RES-2026-000123']);

    expect(app(ProposalService::class)->submit($this->draft->fresh(), $this->pi)->tracker_number)->toBe('RES-2026-000123');
});
