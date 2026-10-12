<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalApprovalReport;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\ThresholdSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function par_makeProposal(string $status, string $category = 'research'): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'PR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'PRD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'Call', 'slug' => 'pr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'PR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $college];
}

test('a college_officer can report a proposal sitting in blind review as possibly mistakenly approved', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $response = $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", [
            'issue_type' => 'other',
            'reason' => 'This looks like a duplicate of an already-funded proposal.',
        ]);

    $response->assertCreated();
    $this->assertDatabaseHas('proposal_approval_reports', [
        'proposal_id' => $proposal->id, 'reported_by' => $officer->id, 'status' => 'open',
    ]);
});

test('a college_officer can report a validated proposal awaiting reviewer assignment', function () {
    [$proposal, $college] = par_makeProposal('validated');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", [
            'issue_type' => 'other',
            'reason' => 'This should have never passed validation.',
        ])
        ->assertCreated();
});

test('a college_officer can report a proposal that already passed blind review', function () {
    [$proposal, $college] = par_makeProposal('blind_review_passed');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", [
            'issue_type' => 'other',
            'reason' => 'PI eligibility should be rechecked.',
        ])
        ->assertCreated();
});

test('a non-college_officer role cannot file an approval report', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Trying to report as the wrong role.'])
        ->assertStatus(403);
});

test('a college_officer cannot report a proposal from a different college', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $otherCollege = College::create(['name' => 'Other '.rand(), 'code' => 'OC'.rand(10, 99)]);
    $officer = User::factory()->create(['college_id' => $otherCollege->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Reporting a proposal outside my college.'])
        ->assertStatus(403);
});

test('a proposal not currently in blind review cannot be reported', function () {
    [$proposal, $college] = par_makeProposal('draft');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Reporting a draft proposal.'])
        ->assertStatus(422);
});

test('a second open report cannot be filed while one is already open', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'First report on this proposal.'])
        ->assertCreated();

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Second report on this proposal.'])
        ->assertStatus(422);
});

test('an issue must be selected, and "other" needs a description of at least 10 characters', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $file = fn (array $payload) => $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", $payload);

    $file(['reason' => 'No issue type selected here.'])->assertStatus(422)->assertJsonValidationErrors('issue_type');
    $file(['issue_type' => 'made_up_issue'])->assertStatus(422)->assertJsonValidationErrors('issue_type');
    $file(['issue_type' => 'other'])->assertStatus(422)->assertJsonValidationErrors('reason');
    $file(['issue_type' => 'other', 'reason' => 'short'])->assertStatus(422)->assertJsonValidationErrors('reason');
});

test('a listed issue can be reported without extra details, and directors see it in the notification', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'not_anonymous'])
        ->assertCreated()
        ->assertJsonPath('data.issue_label', 'Not anonymous — author identity revealed');

    $central = User::role('central_officer')->first();
    $notice = DB::table('notifications')->where('notifiable_id', $central->id)->where('type', 'approval_report_submitted')->first();
    expect(json_decode($notice->data, true)['message'])->toContain('Issue: Not anonymous — author identity revealed');
});

test('the rejection reason sent to the team names the reported issue and its details', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'not_anonymous', 'reason' => 'PI name on page 1 of the proposal document.'])
        ->assertCreated();
    $report = ProposalApprovalReport::where('proposal_id', $proposal->id)->firstOrFail();

    par_resolve($report, 'approval_revoked', 'Confirmed — identity is clearly revealed.')->assertOk();

    expect($proposal->fresh()->rejection_reason)
        ->toContain('Not anonymous — author identity revealed — PI name on page 1 of the proposal document.')
        ->toContain('Confirmed — identity is clearly revealed.');
});

test('central_officer and the matching category officer can resolve a report', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review', 'research');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Needs a second look.'])->assertCreated();

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');
    $report = ProposalApprovalReport::where('proposal_id', $proposal->id)->firstOrFail();

    $response = $this->actingAs($researchOfficer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/resolve", ['outcome' => 'approval_stands', 'resolution_notes' => 'Checked — approval stands.']);

    $response->assertOk();
    expect(ProposalApprovalReport::find($report->id)->status)->toBe('reviewed');
});

test('a college_officer cannot resolve a report', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Needs a second look.'])->assertCreated();

    $report = ProposalApprovalReport::where('proposal_id', $proposal->id)->firstOrFail();

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/resolve", ['outcome' => 'approval_stands', 'resolution_notes' => 'Checked — approval stands.'])
        ->assertStatus(403);
});

// ─── Return-for-investigation workflow transition ─────────────────────────────

test('reporting a proposal under blind review returns it to validated', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $response = $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'This should not have passed.']);

    $response->assertCreated()->assertJsonFragment(['message' => 'Reported. The proposal has been returned to validated status for the category officer to review.']);
    expect($proposal->fresh()->status)->toBe('validated');
});

test('reporting a proposal that already passed blind review returns it to validated', function () {
    [$proposal, $college] = par_makeProposal('blind_review_passed');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'PI eligibility should be rechecked.'])
        ->assertCreated();

    expect($proposal->fresh()->status)->toBe('validated');
});

test('reporting an already-validated proposal leaves its status unchanged', function () {
    [$proposal, $college] = par_makeProposal('validated');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $response = $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'This should have never passed validation.']);

    $response->assertCreated()->assertJsonFragment(['message' => 'Reported. Central office and the category officer have been notified.']);
    expect($proposal->fresh()->status)->toBe('validated');
});

test('a category officer can reject a proposal returned to validated by a report', function () {
    [$proposal, $college] = par_makeProposal('blind_review_passed', 'research');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'PI eligibility should be rechecked.'])
        ->assertCreated();

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $this->actingAs($researchOfficer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/validation/reject", ['reason' => 'Confirmed — this should not have been approved.'])
        ->assertOk();

    expect($proposal->fresh()->status)->toBe('rejected');
});

test('the PI is not sent a "passed validation" notification when a report returns the proposal to validated', function () {
    Queue::fake();
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'This should not have passed.'])
        ->assertCreated();

    Queue::assertNotPushed(SendEmailNotificationJob::class, fn ($job) => ($job->data['decision'] ?? null) === 'validated');
});

// ─── indexAll() — the dedicated Approval Reports admin page ───────────────────

test('a central_officer sees all open approval reports across categories', function () {
    [$research, $rCollege] = par_makeProposal('under_blind_review', 'research');
    [$community, $cCollege] = par_makeProposal('under_blind_review', 'community_engagement');
    $rOfficer = User::factory()->create(['college_id' => $rCollege->id]);
    $rOfficer->assignRole('college_officer');
    $cOfficer = User::factory()->create(['college_id' => $cCollege->id]);
    $cOfficer->assignRole('college_officer');
    $this->actingAs($rOfficer, 'sanctum')->postJson("/api/v1/proposals/{$research->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Reason one, long enough.'])->assertCreated();
    $this->actingAs($cOfficer, 'sanctum')->postJson("/api/v1/proposals/{$community->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Reason two, long enough.'])->assertCreated();

    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/approval-reports?status=open')->assertOk();
    $trackerNumbers = collect($response->json('data.data'))->pluck('proposal.tracker_number');

    expect($trackerNumbers)->toContain($research->tracker_number, $community->tracker_number);
});

test('a category officer only sees approval reports for their own category', function () {
    [$research, $rCollege] = par_makeProposal('under_blind_review', 'research');
    [$community, $cCollege] = par_makeProposal('under_blind_review', 'community_engagement');
    $rOfficer = User::factory()->create(['college_id' => $rCollege->id]);
    $rOfficer->assignRole('college_officer');
    $cOfficer = User::factory()->create(['college_id' => $cCollege->id]);
    $cOfficer->assignRole('college_officer');
    $this->actingAs($rOfficer, 'sanctum')->postJson("/api/v1/proposals/{$research->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Reason one, long enough.'])->assertCreated();
    $this->actingAs($cOfficer, 'sanctum')->postJson("/api/v1/proposals/{$community->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Reason two, long enough.'])->assertCreated();

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')->getJson('/api/v1/approval-reports?status=open')->assertOk();
    $trackerNumbers = collect($response->json('data.data'))->pluck('proposal.tracker_number');

    expect($trackerNumbers)->toContain($research->tracker_number)
        ->and($trackerNumbers)->not->toContain($community->tracker_number);
});

test('a college_officer sees only the reports they personally filed, and cannot resolve them', function () {
    [$proposalA, $collegeA] = par_makeProposal('under_blind_review');
    [$proposalB, $collegeB] = par_makeProposal('under_blind_review');
    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');
    $officerB = User::factory()->create(['college_id' => $collegeB->id]);
    $officerB->assignRole('college_officer');

    $this->actingAs($officerA, 'sanctum')->postJson("/api/v1/proposals/{$proposalA->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Filed by officer A.'])->assertCreated();
    $this->actingAs($officerB, 'sanctum')->postJson("/api/v1/proposals/{$proposalB->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Filed by officer B.'])->assertCreated();

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/approval-reports')->assertOk();
    $trackerNumbers = collect($response->json('data.data'))->pluck('proposal.tracker_number');

    expect($trackerNumbers)->toContain($proposalA->tracker_number)
        ->and($trackerNumbers)->not->toContain($proposalB->tracker_number)
        ->and($response->json('meta.can_resolve'))->toBeFalse();
});

test('a user with no relevant role cannot list approval reports at all', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/approval-reports')
        ->assertStatus(403);
});

test('the status filter separates open from reviewed reports', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Needs a second look.'])->assertCreated();

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $report = ProposalApprovalReport::where('proposal_id', $proposal->id)->firstOrFail();
    $this->actingAs($central, 'sanctum')->postJson("/api/v1/approval-reports/{$report->id}/resolve", ['outcome' => 'approval_stands', 'resolution_notes' => 'Checked — approval stands.'])->assertOk();

    $open = $this->actingAs($central, 'sanctum')->getJson('/api/v1/approval-reports?status=open')->assertOk();
    $reviewed = $this->actingAs($central, 'sanctum')->getJson('/api/v1/approval-reports?status=reviewed')->assertOk();

    expect(collect($open->json('data.data'))->pluck('proposal_id'))->not->toContain($proposal->id);
    expect(collect($reviewed->json('data.data'))->pluck('proposal_id'))->toContain($proposal->id);
});

test('reports for a proposal are listed newest first with reporter and reviewer names', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['name' => 'Officer One', 'college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Needs a second look.'])->assertCreated();

    $response = $this->actingAs($officer, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/approval-reports");

    $response->assertOk();
    expect($response->json('data.0.reported_by.name'))->toBe('Officer One')
        ->and($response->json('data.0.status'))->toBe('open');
});

// ─── Cancelling (withdrawing) a report ───────────────────────────────────────

function par_report(Proposal $proposal, College $college): array
{
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    test()->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'This looks like a duplicate of a funded proposal.'])
        ->assertCreated();

    return [$officer, ProposalApprovalReport::where('proposal_id', $proposal->id)->latest()->first()];
}

test('cancelling a report returns a proposal pulled out of blind review back to under blind review', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [$officer, $report] = par_report($proposal, $college);
    expect($proposal->fresh()->status)->toBe('validated');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/withdraw")
        ->assertOk()
        ->assertJsonPath('message', 'Report cancelled. The proposal has been returned to Under Blind Review.');

    expect($report->fresh()->status)->toBe('withdrawn')
        ->and($report->fresh()->withdrawn_at)->not->toBeNull()
        ->and($proposal->fresh()->status)->toBe('under_blind_review');
});

test('cancelling a report restores a proposal that had already passed blind review', function () {
    [$proposal, $college] = par_makeProposal('blind_review_passed');
    [$officer, $report] = par_report($proposal, $college);

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/withdraw")
        ->assertOk();

    expect($proposal->fresh()->status)->toBe('blind_review_passed');
});

test('cancelling a report on an already-validated proposal just withdraws it', function () {
    [$proposal, $college] = par_makeProposal('validated');
    [$officer, $report] = par_report($proposal, $college);

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/withdraw")
        ->assertOk()
        ->assertJsonPath('message', 'Report cancelled.');

    expect($proposal->fresh()->status)->toBe('validated')
        ->and($report->fresh()->status)->toBe('withdrawn');
});

test('after cancelling, the officer can report the proposal again', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [$officer, $report] = par_report($proposal, $college);
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/approval-reports/{$report->id}/withdraw")->assertOk();

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['issue_type' => 'other', 'reason' => 'Reporting again after checking the records.'])
        ->assertCreated();
});

test('a reviewed report can no longer be cancelled', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [$officer, $report] = par_report($proposal, $college);
    $central = User::role('central_officer')->first();
    $this->actingAs($central, 'sanctum')->postJson("/api/v1/approval-reports/{$report->id}/resolve", ['outcome' => 'approval_stands', 'resolution_notes' => 'Checked — approval stands.'])->assertOk();

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/withdraw")
        ->assertStatus(422)
        ->assertJsonPath('message', 'This report has already been reviewed and can no longer be cancelled.');

    expect($proposal->fresh()->status)->toBe('under_blind_review');
});

test('a report the category officer already acted on can no longer be cancelled', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [$officer, $report] = par_report($proposal, $college);
    $proposal->fresh()->update(['status' => 'rejected']);

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/withdraw")
        ->assertStatus(422)
        ->assertJsonPath('message', 'This report has already been acted on — the proposal is now Rejected — so it can no longer be cancelled.');

    expect($report->fresh()->status)->toBe('open');
});

test('only the officer who filed the report can cancel it', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [, $report] = par_report($proposal, $college);
    $colleague = User::factory()->create(['college_id' => $college->id]);
    $colleague->assignRole('college_officer');

    $this->actingAs($colleague, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/withdraw")
        ->assertForbidden();

    expect($report->fresh()->status)->toBe('open');
});

test('a cancelled report cannot be resolved', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [$officer, $report] = par_report($proposal, $college);
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/approval-reports/{$report->id}/withdraw")->assertOk();

    $this->actingAs(User::role('central_officer')->first(), 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/resolve", ['outcome' => 'approval_stands', 'resolution_notes' => 'Checked — approval stands.'])
        ->assertStatus(422);
});

// ─── Resolving a report: approval stands / approval revoked ──────────────────

function par_resolve(ProposalApprovalReport $report, string $outcome, string $notes = 'Checked the records carefully.', ?User $as = null)
{
    $as ??= User::role('central_officer')->first();

    return test()->actingAs($as, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/resolve", ['outcome' => $outcome, 'resolution_notes' => $notes]);
}

function par_blindAssignment(Proposal $proposal, int $score, string $status = 'submitted'): ReviewAssignment
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = EvaluationType::create(['name' => 'blind_review_par_'.Str::random(6), 'label' => 'BR', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => User::role('central_officer')->first()->id, 'status' => $status,
        'assigned_at' => now(), 'submitted_at' => $status === 'submitted' ? now() : null,
    ]);

    if ($status === 'submitted') {
        ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $question->id, 'score' => $score]);
    }

    return $assignment;
}

test('approval stands returns the proposal to blind review when scores are still outstanding', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    par_blindAssignment($proposal, 0, 'pending');
    [$officer, $report] = par_report($proposal, $college);

    par_resolve($report, 'approval_stands')
        ->assertOk()
        ->assertJsonPath('message', 'Approval stands. The proposal is now at Under Blind Review.');

    expect($proposal->fresh()->status)->toBe('under_blind_review')
        ->and($report->fresh()->outcome)->toBe('approval_stands')
        ->and($report->fresh()->status)->toBe('reviewed');
});

test('approval stands moves the proposal on when every blind review was submitted while it was held', function () {
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 60]);
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $pending = par_blindAssignment($proposal, 0, 'pending');
    [$officer, $report] = par_report($proposal, $college);

    // The reviewer finishes while the report holds the proposal at validated.
    $pending->update(['status' => 'submitted', 'submitted_at' => now()]);
    ReviewScore::create([
        'review_assignment_id' => $pending->id,
        'evaluation_question_id' => EvaluationQuestion::whereHas('category', fn ($q) => $q->where('evaluation_type_id', $pending->evaluation_type_id))->value('id'),
        'score' => 70,
    ]);

    par_resolve($report, 'approval_stands')
        ->assertOk()
        ->assertJsonPath('message', 'Approval stands. The proposal is now at Blind Review Passed.');

    expect($proposal->fresh()->status)->toBe('blind_review_passed');
});

test('approval stands restores a proposal that had already passed blind review', function () {
    [$proposal, $college] = par_makeProposal('blind_review_passed');
    [, $report] = par_report($proposal, $college);

    par_resolve($report, 'approval_stands')->assertOk();

    expect($proposal->fresh()->status)->toBe('blind_review_passed');
});

test('a confirmed mistaken approval rejects the proposal with both officers\' notes and tells the team', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $outstanding = par_blindAssignment($proposal, 0, 'pending');
    [$officer, $report] = par_report($proposal, $college);

    par_resolve($report, 'approval_revoked', 'Confirmed: identical to TRK-0042, funded last year.')
        ->assertOk()
        ->assertJsonPath('message', 'Mistaken approval confirmed. The proposal has been rejected and the proposal team notified.');

    $proposal->refresh();
    expect($proposal->status)->toBe('rejected')
        ->and($proposal->rejection_reason)->toContain('This looks like a duplicate of a funded proposal.')
        ->and($proposal->rejection_reason)->toContain('Confirmed: identical to TRK-0042, funded last year.')
        ->and($outstanding->fresh()->status)->toBe('cancelled')
        ->and($report->fresh()->outcome)->toBe('approval_revoked');

    $piNotice = DB::table('notifications')->where('notifiable_id', $proposal->pi_user_id)->where('type', 'decision_result')->latest('created_at')->first();
    expect($piNotice)->not->toBeNull()
        ->and(json_decode($piNotice->data, true)['reason'])->toContain('Confirmed: identical to TRK-0042');
});

test('the reporting officer is told the outcome', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [$officer, $report] = par_report($proposal, $college);

    par_resolve($report, 'approval_revoked', 'Confirmed duplicate of a funded project.')->assertOk();

    expect(DB::table('notifications')->where('notifiable_id', $officer->id)->where('type', 'approval_report_resolved')->exists())->toBeTrue();
});

test('a category officer cannot resolve a report for another category', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review', 'research');
    [, $report] = par_report($proposal, $college);
    $communityOfficer = User::factory()->create();
    $communityOfficer->assignRole('community_officer');

    par_resolve($report, 'approval_revoked', 'Rejecting this one now.', $communityOfficer)->assertForbidden();

    expect($proposal->fresh()->status)->toBe('validated')
        ->and($report->fresh()->status)->toBe('open');
});

test('a resolution note is required', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    [, $report] = par_report($proposal, $college);

    par_resolve($report, 'approval_stands', 'short')->assertStatus(422);
});
