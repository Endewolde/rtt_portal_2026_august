<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function cpc_admin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

function cpc_college(): College
{
    return College::create(['name' => 'C'.rand(), 'code' => 'CPC'.rand(1000, 9999), 'status' => 'active']);
}

function cpc_makeProposal(College $college, string $status, User $creator): Proposal
{
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CPCD'.rand(1000, 9999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research',
        'title' => 'Call', 'slug' => 'cpc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $creator->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'CPC-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026-2027', 'created_by' => $pi->id,
    ]);
}

function cpc_assign(Proposal $proposal, User $actor, string $evalPrefix): void
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $type = EvaluationType::create(['name' => $evalPrefix.'_'.Str::random(6), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);

    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $actor->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
}

function cpc_logRejection(Proposal $proposal, User $actor, string $action, string $from, string $to = 'rejected'): void
{
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(),
        'proposal_id' => $proposal->id,
        'from_stage' => $from,
        'action' => $action,
        'to_stage' => $to,
        'actor_id' => $actor->id,
        'notes' => null,
        'metadata' => null,
        'created_at' => now(),
    ]);
}

test('a non-admin/officer/college-officer role is forbidden', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertForbidden();
});

test('a validated proposal with no reviewer yet counts against blind review completion', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    cpc_makeProposal($college, 'validated', $admin);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $blind = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id)['phases']['blind_review'];

    expect($blind['total'])->toBe(1)
        ->and($blind['assigned'])->toBe(0)
        ->and($blind['unassigned'])->toBe(1)
        ->and($blind['completion_pct'])->toBe(0);
});

test('only validated proposals count for blind review, and only those that passed blind review count for open defence', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    cpc_makeProposal($college, 'submitted', $admin);                  // awaiting validation — in neither phase
    $rejectedAtValidation = cpc_makeProposal($college, 'rejected', $admin);
    cpc_logRejection($rejectedAtValidation, $admin, 'reject', 'submitted'); // never validated — in neither phase
    $underBlind = cpc_makeProposal($college, 'under_blind_review', $admin);
    cpc_assign($underBlind, $admin, 'blind_review');                  // blind only, pending
    $failedBlind = cpc_makeProposal($college, 'rejected', $admin);
    cpc_assign($failedBlind, $admin, 'blind_review');
    cpc_logRejection($failedBlind, $admin, 'fail_blind_review', 'under_blind_review'); // blind only, rejected
    cpc_makeProposal($college, 'blind_review_passed', $admin);         // passed blind (no blind assignment here) — defence, unassigned
    $legacy = cpc_makeProposal($college, 'funded', $admin);
    cpc_logRejection($legacy, $admin, 'grant_legacy', 'submitted', 'funded'); // legacy grant — skipped review, in neither phase

    $phases = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/college-phase-completion')->assertOk()->json('data.colleges'))
        ->firstWhere('college_id', $college->id)['phases'];

    expect($phases['blind_review']['total'])->toBe(3)
        ->and($phases['blind_review']['pending'])->toBe(1)
        ->and($phases['blind_review']['rejected'])->toBe(1)
        ->and($phases['open_defence']['total'])->toBe(1)
        ->and($phases['open_defence']['unassigned'])->toBe(1)
        ->and($phases['open_defence']['completion_pct'])->toBe(0);
});

test('a college with zero submitted proposals reports null completion (nothing to report on)', function () {
    $admin = cpc_admin();
    $college = cpc_college();

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $row = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id);

    expect($row['phases']['blind_review']['completion_pct'])->toBeNull();
});

test('a college is not 100% complete while any submitted proposal still lacks a reviewer assignment', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    $reviewed = cpc_makeProposal($college, 'blind_review_passed', $admin);
    cpc_assign($reviewed, $admin, 'blind_review');
    cpc_makeProposal($college, 'validated', $admin); // validated, never assigned a reviewer

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $blind = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id)['phases']['blind_review'];

    expect($blind['total'])->toBe(2)
        ->and($blind['assigned'])->toBe(1)
        ->and($blind['unassigned'])->toBe(1)
        ->and($blind['reviewed'])->toBe(1)
        ->and($blind['completion_pct'])->toBe(50);
});

test('a proposal still under blind review counts as assigned but pending, not reviewed', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    $proposal = cpc_makeProposal($college, 'under_blind_review', $admin);
    cpc_assign($proposal, $admin, 'blind_review');

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $row = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id);
    $blind = $row['phases']['blind_review'];

    expect($blind['assigned'])->toBe(1)
        ->and($blind['pending'])->toBe(1)
        ->and($blind['reviewed'])->toBe(0)
        ->and($blind['rejected'])->toBe(0)
        ->and($blind['completion_pct'])->toBe(0);
});

test('a proposal that passed blind review counts as reviewed, separate from rejected', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    $proposal = cpc_makeProposal($college, 'blind_review_passed', $admin);
    cpc_assign($proposal, $admin, 'blind_review');

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $blind = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id)['phases']['blind_review'];

    expect($blind['assigned'])->toBe(1)
        ->and($blind['reviewed'])->toBe(1)
        ->and($blind['rejected'])->toBe(0)
        ->and($blind['pending'])->toBe(0)
        ->and($blind['completion_pct'])->toBe(100);
});

test('a proposal rejected AT blind review counts as rejected for that phase', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    $proposal = cpc_makeProposal($college, 'rejected', $admin);
    cpc_assign($proposal, $admin, 'blind_review');
    cpc_logRejection($proposal, $admin, 'fail_blind_review', 'under_blind_review');

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $blind = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id)['phases']['blind_review'];

    expect($blind['assigned'])->toBe(1)
        ->and($blind['reviewed'])->toBe(0)
        ->and($blind['rejected'])->toBe(1)
        ->and($blind['completion_pct'])->toBe(100);
});

test('a proposal rejected at a LATER phase (defence) does not count against blind review\'s rejected bucket', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    $proposal = cpc_makeProposal($college, 'rejected', $admin);
    cpc_assign($proposal, $admin, 'blind_review');
    cpc_assign($proposal, $admin, 'open_defence');
    cpc_logRejection($proposal, $admin, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');
    cpc_logRejection($proposal, $admin, 'fail_defence', 'under_open_defence');

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $colleges = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id)['phases'];

    // Blind review was assigned and never had a rejection recorded for IT — the
    // proposal completed blind review successfully before failing later at defence.
    expect($colleges['blind_review']['assigned'])->toBe(1)
        ->and($colleges['blind_review']['rejected'])->toBe(0)
        ->and($colleges['blind_review']['reviewed'])->toBe(1)
        ->and($colleges['open_defence']['assigned'])->toBe(1)
        ->and($colleges['open_defence']['rejected'])->toBe(1);
});

test('a proposal rejected, reopened, then rejected again at a different phase is judged by the LATEST rejection only', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    $proposal = cpc_makeProposal($college, 'rejected', $admin);
    cpc_assign($proposal, $admin, 'blind_review');
    cpc_assign($proposal, $admin, 'open_defence');

    cpc_logRejection($proposal, $admin, 'fail_blind_review', 'under_blind_review');
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id,
        'from_stage' => 'rejected', 'action' => 'reopen', 'to_stage' => 'under_open_defence',
        'actor_id' => $admin->id, 'notes' => null, 'metadata' => null, 'created_at' => now()->addMinute(),
    ]);
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id,
        'from_stage' => 'under_open_defence', 'action' => 'fail_defence', 'to_stage' => 'rejected',
        'actor_id' => $admin->id, 'notes' => null, 'metadata' => null, 'created_at' => now()->addMinutes(2),
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion')
        ->assertOk();

    $phases = collect($res->json('data.colleges'))->firstWhere('college_id', $college->id)['phases'];

    expect($phases['blind_review']['rejected'])->toBe(0)
        ->and($phases['open_defence']['rejected'])->toBe(1);
});

test('a no-show defence whose panel was removed counts as rejected at open defence, not waiting for assignment', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    $noShow = cpc_makeProposal($college, 'rejected', $admin);
    cpc_assign($noShow, $admin, 'blind_review');
    cpc_logRejection($noShow, $admin, 'pass_blind_review', 'under_blind_review', 'blind_review_passed');
    cpc_logRejection($noShow, $admin, 'fail_defence', 'under_open_defence'); // panel assignments deleted on no-show

    $phases = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/college-phase-completion')->assertOk()->json('data.colleges'))
        ->firstWhere('college_id', $college->id)['phases'];

    expect($phases['open_defence']['total'])->toBe(1)
        ->and($phases['open_defence']['unassigned'])->toBe(0)
        ->and($phases['open_defence']['rejected'])->toBe(1)
        ->and($phases['open_defence']['completion_pct'])->toBe(100)
        ->and($phases['blind_review']['reviewed'])->toBe(1);
});

test('a proposal that moved past open defence counts as reviewed even without a surviving defence assignment', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    cpc_makeProposal($college, 'funded', $admin);
    cpc_makeProposal($college, 'under_open_defence', $admin); // under defence, no panel yet

    $defence = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/college-phase-completion')->assertOk()->json('data.colleges'))
        ->firstWhere('college_id', $college->id)['phases']['open_defence'];

    expect($defence['total'])->toBe(2)
        ->and($defence['reviewed'])->toBe(1)
        ->and($defence['unassigned'])->toBe(1)
        ->and($defence['pending'])->toBe(0);
});

test('college_id filter narrows the result to a single college', function () {
    $admin = cpc_admin();
    $collegeA = cpc_college();
    $collegeB = cpc_college();
    cpc_makeProposal($collegeA, 'submitted', $admin);
    cpc_makeProposal($collegeB, 'submitted', $admin);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/college-phase-completion?college_id='.$collegeA->id)
        ->assertOk();

    $ids = collect($res->json('data.colleges'))->pluck('college_id');
    expect($ids)->toHaveCount(1)->and($ids->first())->toBe($collegeA->id);
});

test('a college_officer scoped to one college cannot widen the view via a client-supplied college_id', function () {
    $officer = User::factory()->create();
    $officer->assignRole('college_officer');
    $ownCollege = cpc_college();
    $otherCollege = cpc_college();
    $officer->college_id = $ownCollege->id;
    $officer->save();
    cpc_makeProposal($ownCollege, 'submitted', $officer);
    cpc_makeProposal($otherCollege, 'submitted', $officer);

    $res = $this->actingAs($officer, 'sanctum')
        ->getJson('/api/v1/college-phase-completion?college_id='.$otherCollege->id)
        ->assertOk();

    $ids = collect($res->json('data.colleges'))->pluck('college_id');
    expect($ids)->toHaveCount(1)->and($ids->first())->toBe($ownCollege->id);
});

test('the report downloads as a PDF for the colleges and phase shown', function () {
    $admin = cpc_admin();
    $college = cpc_college();
    cpc_makeProposal($college, 'blind_review_passed', $admin);

    $this->actingAs($admin, 'sanctum')
        ->get('/api/v1/college-phase-completion/export?phase=open_defence&college_id='.$college->id)
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf')
        ->assertDownload('college-phase-completion-'.now()->format('Y-m-d').'.pdf');
});

test('the PDF export is forbidden without phase completion access and rejects an unknown phase', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->getJson('/api/v1/college-phase-completion/export')
        ->assertForbidden();

    $this->actingAs(cpc_admin(), 'sanctum')
        ->getJson('/api/v1/college-phase-completion/export?phase=midterm')
        ->assertUnprocessable();
});

test('a guest asking for the PDF without a JSON accept header gets a 401, not a server error', function () {
    $this->get('/api/v1/college-phase-completion/export?phase=both')
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Unauthenticated. Please log in.');
});

test('the PDF still downloads on a server whose dompdf font cache folder does not exist yet', function () {
    $fontCache = sys_get_temp_dir().'/dompdf-fonts-'.Str::random(8);
    config(['dompdf.options.font_cache' => $fontCache, 'dompdf.options.font_dir' => $fontCache]);

    $this->actingAs(cpc_admin(), 'sanctum')
        ->get('/api/v1/college-phase-completion/export?phase=both')
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    expect(is_dir($fontCache))->toBeTrue();

    File::deleteDirectory($fontCache);
});
