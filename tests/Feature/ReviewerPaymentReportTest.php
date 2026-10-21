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
use PhpOffice\PhpSpreadsheet\IOFactory;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->collegeA = College::create(['name' => 'Agriculture', 'code' => 'PA'.rand(10000, 99999)]);
    $this->collegeB = College::create(['name' => 'Business', 'code' => 'PB'.rand(10000, 99999)]);
    $this->blind = EvaluationType::create(['name' => 'blind_review_pay', 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $this->defence = EvaluationType::create(['name' => 'open_defence_pay', 'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true]);

    $this->proposal = function (College $college, string $title, string $year = '2026') {
        $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'PD'.rand(100000, 999999)]);
        $call = ProposalCall::create(['academic_year' => $year, 'category' => 'research', 'title' => 'Call', 'slug' => 'pay-'.rand(100000, 999999),
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id]);

        return Proposal::create(['tracker_number' => 'PAY-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => $title,
            'status' => 'under_blind_review', 'pi_user_id' => $this->central->id, 'college_id' => $college->id, 'department_id' => $dept->id,
            'academic_year' => $year, 'created_by' => $this->central->id]);
    };
    $this->assign = fn (Proposal $p, User $reviewer, EvaluationType $type, string $status) => ReviewAssignment::create([
        'proposal_id' => $p->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id, 'assigned_by' => $this->central->id,
        'status' => $status, 'assigned_at' => now(), 'submitted_at' => $status === 'submitted' ? now() : null,
    ]);

    $this->read = function ($response): array {
        $book = IOFactory::load($response->baseResponse->getFile()->getPathname());

        return [$book->getSheet(0)->toArray(null, true, false), $book->getSheet(1)->toArray(null, true, false)];
    };
});

test('the payment report lists every review with the reviewer\'s completed and not-completed totals', function () {
    $abebe = User::factory()->create(['name' => 'Abebe Kebede']);
    $abebe->assignRole('staff');
    $sara = User::factory()->create(['name' => 'Sara Tesfaye']);
    $sara->assignRole('external_reviewer');

    $soil = ($this->proposal)($this->collegeA, 'Soil Study');
    $market = ($this->proposal)($this->collegeB, 'Market Study');
    ($this->assign)($soil, $abebe, $this->blind, 'submitted');
    ($this->assign)($market, $abebe, $this->defence, 'submitted');
    ($this->assign)($market, $abebe, $this->blind, 'pending');
    ($this->assign)($soil, $sara, $this->blind, 'declined'); // listed, counted in neither total

    $response = $this->actingAs($this->central, 'sanctum')->get('/api/v1/admin/reviewer-workload/payment-report')->assertOk();
    [$details, $summary] = ($this->read)($response);

    expect($details[1])->toBe(['Reviewer Name', 'Proposal Title', 'Review Type', 'Review Status', 'College', 'Total Reviews Completed', 'Total Reviews Not Completed', 'Tracker Number', 'Reviewer Email', 'Reviewer Type', 'Submitted On']);

    $abebeRows = collect($details)->slice(2)->where(0, 'Abebe Kebede');
    expect($abebeRows)->toHaveCount(3)
        ->and($abebeRows->pluck(2)->sort()->values()->all())->toBe(['Blind Review', 'Blind Review', 'Open Defence'])
        ->and($abebeRows->pluck(5)->unique()->all())->toBe([2])
        ->and($abebeRows->pluck(6)->unique()->all())->toBe([1]);

    $saraRow = collect($details)->slice(2)->firstWhere(0, 'Sara Tesfaye');
    expect($saraRow[3])->toBe('Declined')->and($saraRow[5])->toBe(0)->and($saraRow[6])->toBe(0)->and($saraRow[9])->toBe('External');

    // Summary: one row per reviewer, then totals.
    expect($summary[2])->toBe(['Abebe Kebede', $abebe->email, 'Internal', 'Agriculture, Business', 1, 1, 2, 1])
        ->and(end($summary))->toBe(['Total', null, null, null, 1, 1, 2, 1]);
});

test('filters narrow the report, and college officers only get their own college', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');
    $soil = ($this->proposal)($this->collegeA, 'Soil Study', '2026');
    $market = ($this->proposal)($this->collegeB, 'Market Study', '2025');
    ($this->assign)($soil, $reviewer, $this->blind, 'submitted');
    ($this->assign)($market, $reviewer, $this->defence, 'submitted');

    $titles = fn ($response) => collect(($this->read)($response)[0])->slice(2)->pluck(1)->values()->all();

    expect($titles($this->actingAs($this->central, 'sanctum')->get('/api/v1/admin/reviewer-workload/payment-report?academic_year=2025')))->toBe(['Market Study'])
        ->and($titles($this->actingAs($this->central, 'sanctum')->get('/api/v1/admin/reviewer-workload/payment-report?review_type=blind')))->toBe(['Soil Study']);

    $officer = User::factory()->create(['college_id' => $this->collegeA->id]);
    $officer->assignRole('college_officer');
    expect($titles($this->actingAs($officer, 'sanctum')->get('/api/v1/admin/reviewer-workload/payment-report?college_id='.$this->collegeB->id)))->toBe(['Soil Study']);

    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff, 'sanctum')->get('/api/v1/admin/reviewer-workload/payment-report')->assertForbidden();
});
