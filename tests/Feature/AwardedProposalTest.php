<?php

use App\Jobs\StoreInAppNotificationJob;
use App\Models\Award;
use App\Models\BudgetRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\Disbursement;
use App\Models\EvaluationType;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Services\AnnualReportService;
use App\Services\OfficerDigestService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    $this->college = College::create(['name' => 'Award College', 'code' => 'AC'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'ACD'.rand(10000, 99999)]);
    $this->call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'ac-'.rand(10000, 99999),
        'start_date' => now()->subMonths(3), 'end_date' => now()->subMonth(), 'status' => 'active', 'is_open' => false,
        'created_by' => $this->central->id, 'funding_budget' => 1000000,
    ]);
    $this->pi = User::factory()->create(['college_id' => $this->college->id]);
    $this->pi->assignRole('staff');

    $this->withContract = aw_proposal($this, 'AW-1', 'approved');
    $this->noContract = aw_proposal($this, 'AW-2', null);
});

function aw_proposal(object $t, string $tracker, ?string $contract, ?College $college = null): Proposal
{
    $p = Proposal::create([
        'tracker_number' => $tracker, 'proposal_call_id' => $t->call->id, 'category' => 'research', 'title' => "Project {$tracker}",
        'status' => 'funded', 'pi_user_id' => $t->pi->id, 'college_id' => ($college ?? $t->college)->id, 'department_id' => $t->dept->id,
        'academic_year' => '2026-2027', 'created_by' => $t->pi->id, 'contract_status' => $contract,
        'contract_signed_at' => $contract === 'approved' ? now()->subDays(5) : null,
    ]);
    Award::create(['proposal_id' => $p->id, 'grant_reference' => "GR-{$tracker}", 'awarded_amount' => 200000, 'approved_at' => now()->subDays(20), 'approved_by' => $t->central->id]);

    return $p;
}

test('insights show the money paid, the contract wait, the timeline and a PI\'s other running awards', function () {
    $template = FormTemplate::create(['name' => 'Budget Form', 'is_active' => true, 'created_by' => $this->central->id]);
    $request = BudgetRequest::create(['proposal_id' => $this->withContract->id, 'form_template_id' => $template->id, 'requested_by' => $this->pi->id, 'total_amount' => 80000, 'status' => 'approved']);
    Disbursement::create(['budget_request_id' => $request->id, 'disbursed_by' => $this->central->id, 'amount' => 80000, 'disbursed_at' => now()->subDays(2)]);

    $data = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposals/awarded/insights')->assertOk()->json('data');

    $paid = $data[$this->withContract->id];
    expect($paid['disbursed'])->toEqual(80000)
        ->and($paid['payments'])->toBe(1)
        ->and($paid['contract_waiting_days'])->toBeNull()
        ->and(collect($paid['timeline'])->firstWhere('key', 'paid')['at'])->not->toBeNull()
        ->and($paid['other_running_awards'])->toBe(['AW-2']);

    expect($data[$this->noContract->id]['contract_waiting_days'])->toBe(20)
        ->and($data[$this->noContract->id]['disbursed'])->toEqual(0);
});

test('PIs are reminded only for contracts that are missing or returned', function () {
    $this->actingAs($this->central, 'sanctum')
        ->postJson('/api/v1/proposals/awarded/remind-contracts', ['proposal_ids' => [$this->withContract->id, $this->noContract->id]])
        ->assertOk()
        ->assertJsonPath('data.sent', 1)
        ->assertJsonPath('data.skipped', 1);

    Queue::assertPushed(StoreInAppNotificationJob::class, fn ($job) => $job->event === 'contract_reminder' && $job->userId === $this->pi->id);
    Queue::assertPushed(StoreInAppNotificationJob::class, 1);
    expect(DB::table('audit_logs')->where('event', 'contract.reminder_sent')->where('auditable_id', $this->noContract->id)->exists())->toBeTrue();

    $insights = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposals/awarded/insights')->json('data');
    expect($insights[$this->noContract->id]['last_reminded_at'])->not->toBeNull();
});

test('the award register downloads as a PDF', function () {
    $res = $this->actingAs($this->central, 'sanctum')->get('/api/v1/proposals/awarded/register?year=2026-2027')->assertOk();
    expect($res->headers->get('content-type'))->toContain('pdf');
});

test('a college officer sees only their own college\'s awards and cannot be a plain staff member', function () {
    $other = College::create(['name' => 'Other', 'code' => 'OT'.rand(10000, 99999)]);
    $foreign = aw_proposal($this, 'AW-9', null, $other);

    $officer = User::factory()->create(['college_id' => $this->college->id]);
    $officer->assignRole('college_officer');
    $ids = array_keys($this->actingAs($officer, 'sanctum')->getJson('/api/v1/proposals/awarded/insights')->assertOk()->json('data'));
    expect($ids)->not->toContain($foreign->id)->toContain($this->noContract->id);

    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/proposals/awarded/insights')->assertForbidden();
    $this->actingAs($this->pi, 'sanctum')->postJson('/api/v1/proposals/awarded/remind-contracts', ['proposal_ids' => [$this->noContract->id]])->assertForbidden();
});

test('a PI sees their own awards with the money, timeline and next step', function () {
    $mine = $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/my-awards')->assertOk()->json('data');

    expect(collect($mine)->pluck('tracker_number')->sort()->values()->all())->toBe(['AW-1', 'AW-2']);
    $missing = collect($mine)->firstWhere('tracker_number', 'AW-2');
    expect($missing['next_step']['key'])->toBe('contract_upload')
        ->and($missing['grant_reference'])->toBe('GR-AW-2')
        ->and(collect($mine)->firstWhere('tracker_number', 'AW-1')['next_step']['key'])->toBe('budget_request');

    $other = User::factory()->create();
    $other->assignRole('staff');
    $this->actingAs($other, 'sanctum')->getJson('/api/v1/my-awards')->assertOk()->assertJsonCount(0, 'data');
});

test('the spend forecast flags idle projects per call', function () {
    // AW-1 has its contract in for weeks and has been paid nothing.
    $this->withContract->award->update(['approved_at' => now()->subDays(90)]);

    $rows = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposals/awarded/burn')->assertOk()->json('data');
    expect($rows)->toHaveCount(1)
        ->and($rows[0]['awarded'])->toEqual(400000)
        ->and($rows[0]['paid'])->toEqual(0)
        ->and(collect($rows[0]['idle'])->pluck('tracker_number')->all())->toBe(['AW-1']);
});

test('validators see a PI\'s running awards when checking a new proposal', function () {
    $new = Proposal::create([
        'tracker_number' => 'NEW-1', 'proposal_call_id' => $this->call->id, 'category' => 'research', 'title' => 'New one',
        'status' => 'submitted', 'pi_user_id' => $this->pi->id, 'college_id' => $this->college->id, 'department_id' => $this->dept->id,
        'academic_year' => '2026-2027', 'created_by' => $this->pi->id,
    ]);

    $data = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposal-overlap?ids[]='.$new->id)->assertOk()->json('data');
    expect(collect($data[$new->id]['pi_running_awards'])->sort()->values()->all())->toBe(['AW-1', 'AW-2']);

    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/proposal-overlap?ids[]='.$new->id)->assertForbidden();
});

test('contracts are chased automatically: weekly PI reminders, then officers after three weeks', function () {
    $officer = User::factory()->create(['college_id' => $this->college->id]);
    $officer->assignRole('college_officer');
    $this->noContract->award->update(['approved_at' => now()->subDays(25)]);

    $this->artisan('rtt:contract-chase')->assertSuccessful();
    expect(DB::table('audit_logs')->where('event', 'contract.reminder_sent')->where('auditable_id', $this->noContract->id)->count())->toBe(1)
        ->and(DB::table('audit_logs')->where('event', 'contract.escalated')->where('auditable_id', $this->noContract->id)->count())->toBe(1);
    Queue::assertPushed(StoreInAppNotificationJob::class, fn ($job) => $job->event === 'contract_escalation' && $job->userId === $officer->id);

    // Running again the same day repeats nothing.
    $this->artisan('rtt:contract-chase')->assertSuccessful();
    expect(DB::table('audit_logs')->where('event', 'contract.reminder_sent')->where('auditable_id', $this->noContract->id)->count())->toBe(1);
});

test('the officer digest lists what is waiting, and skips people with nothing', function () {
    $this->noContract->update(['contract_status' => 'pending']);
    $items = app(OfficerDigestService::class)->itemsFor($this->central);

    expect(collect($items)->firstWhere('key', 'contracts_pending_review')['count'])->toBe(1)
        ->and(app(OfficerDigestService::class)->itemsFor($this->pi))->toBeArray();

    $this->artisan('rtt:officer-digest')->assertSuccessful();
});

test('proposals far past their stage target are escalated to the central office', function () {
    $stuck = Proposal::create([
        'tracker_number' => 'STK-1', 'proposal_call_id' => $this->call->id, 'category' => 'research', 'title' => 'Stuck',
        'status' => 'submitted', 'pi_user_id' => $this->pi->id, 'college_id' => $this->college->id, 'department_id' => $this->dept->id,
        'academic_year' => '2026-2027', 'created_by' => $this->pi->id,
    ]);
    DB::table('proposals')->where('id', $stuck->id)->update(['status_entered_at' => now()->subDays(20)]);

    $this->artisan('rtt:stage-escalations')->assertSuccessful();
    expect(DB::table('audit_logs')->where('event', 'stage.escalated')->where('auditable_id', $stuck->id)->exists())->toBeTrue();
    Queue::assertPushed(StoreInAppNotificationJob::class, fn ($job) => $job->event === 'stage_escalation' && $job->userId === $this->central->id);
});

test('the annual report counts submitted reviews and shows awarded and settled money', function () {
    $type = EvaluationType::create(['name' => 'blind_review_ar_'.rand(1000, 9999), 'label' => 'Blind Review', 'proposal_category' => 'research', 'is_active' => true]);
    foreach (['submitted', 'submitted', 'pending', 'cancelled'] as $status) {
        $reviewer = User::factory()->create();
        ReviewAssignment::create([
            'proposal_id' => $this->withContract->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
            'assigned_by' => $this->central->id, 'status' => $status, 'assigned_at' => now(), 'due_date' => now()->addWeek(),
        ]);
    }

    $report = app(AnnualReportService::class)->compile(2026, 2027);

    expect($report['reviews']['total'])->toBe(3)
        ->and($report['reviews']['completed'])->toBe(2)
        ->and($report['reviews']['rate'])->toEqual(66.7)
        ->and($report['reviews']['reviewers'])->toBe(3)
        ->and($report['finance']['awarded'])->toEqual(400000);
});
