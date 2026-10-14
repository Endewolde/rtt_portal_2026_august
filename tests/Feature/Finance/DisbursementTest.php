<?php

use App\Models\BudgetRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\Disbursement;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\DisbursementService;
use Database\Seeders\FormTemplateSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new FormTemplateSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function disb_makeApprovedRequest(float $total = 50000.00): array
{
    $college = College::create(['name' => 'Disb College '.rand(), 'code' => 'DC'.rand(10000, 99999)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'DD'.rand(10000, 99999)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $finance = User::factory()->create();
    $finance->assignRole('finance_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'disb-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Funded Proposal', 'status' => 'funded',
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $template = FormTemplate::first();

    $request = BudgetRequest::create([
        'proposal_id'      => $proposal->id,
        'form_template_id' => $template->id,
        'requested_by'     => $pi->id,
        'total_amount'     => $total,
        'status'           => 'approved',
        'funding_round'    => 1,
    ]);

    return [$request, $finance, $pi];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('finance can disburse approved request', function () {
    [$request, $finance] = disb_makeApprovedRequest();

    $disbursement = app(DisbursementService::class)->disburse(
        $request, 50000.00,
        ['transaction_id' => 'TXN-001', 'cheque_number' => 'CHQ-100', 'notes' => 'First payment'],
        $finance
    );

    expect($disbursement)->toBeInstanceOf(Disbursement::class)
        ->and((float) $disbursement->amount)->toBe(50000.0)
        ->and($disbursement->transaction_id)->toBe('TXN-001');
});

test('partial disbursement works — two disbursements sum to total', function () {
    [$request, $finance] = disb_makeApprovedRequest(60000.00);
    $service = app(DisbursementService::class);

    $d1 = $service->disburse($request, 40000.00, ['transaction_id' => 'TXN-A'], $finance);
    $d2 = $service->disburse($request->fresh(), 20000.00, ['transaction_id' => 'TXN-B'], $finance);

    expect((float) $d1->amount)->toBe(40000.0)
        ->and((float) $d2->amount)->toBe(20000.0)
        ->and(Disbursement::where('budget_request_id', $request->id)->sum('amount'))->toEqual(60000.0);
});

test('cannot disburse more than total_amount', function () {
    [$request, $finance] = disb_makeApprovedRequest(50000.00);

    expect(fn () => app(DisbursementService::class)->disburse(
        $request, 99999.00, [], $finance
    ))->toThrow(\Exception::class, 'exceeds remaining undisbursed amount');
});

test('status changes to disbursed when fully disbursed', function () {
    [$request, $finance] = disb_makeApprovedRequest(50000.00);

    app(DisbursementService::class)->disburse($request, 50000.00, [], $finance);

    expect($request->fresh()->status)->toBe('disbursed');
});

test('budget transaction record created on disbursement', function () {
    [$request, $finance] = disb_makeApprovedRequest(50000.00);

    app(DisbursementService::class)->disburse(
        $request, 50000.00, ['transaction_id' => 'TXN-999'], $finance
    );

    $tx = DB::table('budget_transactions')
        ->where('budget_request_id', $request->id)
        ->where('transaction_type', 'disbursement')
        ->first();

    expect($tx)->not->toBeNull()
        ->and((float) $tx->amount)->toBe(50000.0)
        ->and($tx->reference_number)->toBe('TXN-999');
});
