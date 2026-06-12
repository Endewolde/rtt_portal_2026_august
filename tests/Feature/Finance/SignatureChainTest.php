<?php

use App\Events\AllSignaturesComplete;
use App\Events\MemberRefusedSignature;
use App\Exceptions\UnsignedMembersException;
use App\Models\BudgetRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\FormSignature;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\BudgetRequestService;
use App\Services\SignatureService;
use Database\Seeders\FormTemplateSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new FormTemplateSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sig_makeRequestWithTwoMembers(): array
{
    $college = College::create(['name' => 'Sig College '.rand(), 'code' => 'SG'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'SD'.rand(10, 99)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $coI = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $coI->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'sig-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Sig Proposal', 'status' => 'funded',
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $pi->id,
        'role' => 'pi', 'status' => 'active',
        'contribution_percentage' => 50, 'joined_at' => now(),
    ]);
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $coI->id,
        'role' => 'co_investigator', 'status' => 'active',
        'contribution_percentage' => 50, 'joined_at' => now(),
    ]);

    $template = FormTemplate::where('name', 'Research Budget Request')->first();
    $items    = [
        ['category' => 'Personnel', 'description' => 'RA Salary', 'amount' => 30000, 'justification' => null],
    ];

    $request = app(BudgetRequestService::class)->create($proposal, $template->id, $items, $pi);

    return [$request, $pi, $coI];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('member can sign budget request', function () {
    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();

    $signature = app(SignatureService::class)->sign($request, $pi, '127.0.0.1');

    expect($signature->status)->toBe('signed')
        ->and($signature->signed_at)->not->toBeNull()
        ->and($signature->ip_address)->toBe('127.0.0.1');
});

test('all signatures complete sets all_signatures_complete = true', function () {
    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();
    $service = app(SignatureService::class);

    $service->sign($request, $pi, '127.0.0.1');
    $service->sign($request, $coI, '127.0.0.2');

    expect($request->fresh()->all_signatures_complete)->toBeTrue();
});

test('all signatures complete fires AllSignaturesComplete event', function () {
    Event::fake([AllSignaturesComplete::class]);

    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();
    $service = app(SignatureService::class);

    $service->sign($request, $pi, '127.0.0.1');
    $service->sign($request, $coI, '127.0.0.2');

    Event::assertDispatched(AllSignaturesComplete::class, fn ($e) => $e->request->id === $request->id);
});

test('member can refuse with reason', function () {
    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();

    $signature = app(SignatureService::class)->refuse($request, $coI, 'Budget too high', '10.0.0.1');

    expect($signature->status)->toBe('refused')
        ->and($signature->refusal_reason)->toBe('Budget too high')
        ->and($signature->refused_at)->not->toBeNull();
});

test('refusal fires MemberRefusedSignature event', function () {
    Event::fake([MemberRefusedSignature::class]);

    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();

    app(SignatureService::class)->refuse($request, $coI, 'Disagreement', '10.0.0.1');

    Event::assertDispatched(MemberRefusedSignature::class, function ($e) use ($request, $coI) {
        return $e->request->id === $request->id
            && $e->member->id === $coI->id
            && $e->reason === 'Disagreement';
    });
});

test('cannot submit with pending signatures', function () {
    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();

    expect(fn () => app(BudgetRequestService::class)->submit($request, $pi))
        ->toThrow(UnsignedMembersException::class);
});

test('cannot submit with refused signatures', function () {
    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();
    $sig = app(SignatureService::class);

    $sig->sign($request, $pi, '127.0.0.1');
    $sig->refuse($request, $coI, 'Not happy', '127.0.0.2');

    expect(fn () => app(BudgetRequestService::class)->submit($request, $pi))
        ->toThrow(UnsignedMembersException::class);
});

test('can submit only when ALL signatures have status=signed', function () {
    [$request, $pi, $coI] = sig_makeRequestWithTwoMembers();
    $sig = app(SignatureService::class);

    $sig->sign($request, $pi, '127.0.0.1');
    $sig->sign($request, $coI, '127.0.0.2');

    $submitted = app(BudgetRequestService::class)->submit($request, $pi);

    expect($submitted->status)->toBe('submitted')
        ->and($submitted->submitted_at)->not->toBeNull();
});
