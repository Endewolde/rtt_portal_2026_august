<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReportSnapshot;
use App\Models\ResearchOutput;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->collegeA = College::create(['name' => 'Alpha College', 'code' => 'LA'.rand(10000, 99999)]);
    $this->collegeB = College::create(['name' => 'Beta College', 'code' => 'LB'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'lr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);

    $this->make = function (College $college, string $category, string $year, string $status = 'submitted') use ($call) {
        $dept = Department::firstOrCreate(['college_id' => $college->id, 'name' => 'D'], ['code' => 'LD'.rand(10000, 99999)]);
        $pi = User::factory()->create();

        return Proposal::create([
            'tracker_number' => 'LR-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => $category,
            'title' => 'Live '.rand(), 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => $year, 'created_by' => $pi->id,
        ]);
    };

    ($this->make)($this->collegeA, 'research', '2026-2027', 'funded');
    ($this->make)($this->collegeA, 'community_engagement', '2026-2027');
    ($this->make)($this->collegeB, 'research', '2026-2027', 'rejected');
    ($this->make)($this->collegeB, 'research', '2025-2026');
});

test('a report opens live, without generating, and the filters narrow it', function () {
    $this->actingAs($this->central, 'sanctum');

    $all = $this->getJson('/api/v1/reports/live/proposal_count_by_college')->assertOk();
    expect(collect($all->json('data'))->sum('total_proposals'))->toBe(4)
        ->and($all->json('meta.generated_at'))->not->toBeNull()
        ->and(ReportSnapshot::count())->toBe(0);

    $narrow = $this->getJson('/api/v1/reports/live/proposal_count_by_college?academic_year=2026-2027&category=research')->assertOk();
    expect(collect($narrow->json('data'))->pluck('total_proposals', 'college_name')->map(fn ($n) => (int) $n)->all())
        ->toBe(['Alpha College' => 1, 'Beta College' => 1])
        ->and($narrow->json('data.0.college_id'))->not->toBeNull();
});

test('a college officer only ever sees their own college, whatever they ask for', function () {
    $officer = User::factory()->create(['college_id' => $this->collegeA->id]);
    $officer->assignRole('college_officer');

    $rows = $this->actingAs($officer, 'sanctum')
        ->getJson("/api/v1/reports/live/proposal_count_by_college?college_id={$this->collegeB->id}")
        ->assertOk()->json('data');

    expect(collect($rows)->pluck('college_name')->all())->toBe(['Alpha College']);

    $options = $this->getJson('/api/v1/reports/live-options')->assertOk();
    expect($options->json('data.college_scoped'))->toBeTrue()
        ->and(collect($options->json('data.colleges'))->pluck('name')->all())->toBe(['Alpha College']);
});

test('fresh figures skip the cache', function () {
    $this->actingAs($this->central, 'sanctum');
    $count = fn ($q = '') => collect($this->getJson('/api/v1/reports/live/proposal_count_by_category'.$q)->json('data'))->sum('total');

    expect($count())->toBe(4);
    ($this->make)($this->collegeA, 'research', '2026-2027');
    expect($count())->toBe(4)
        ->and($count('?fresh=1'))->toBe(5);
});

test('the live report downloads as Excel without the internal ids', function () {
    $response = $this->actingAs($this->central, 'sanctum')
        ->get('/api/v1/reports/live/proposal_count_by_college/export?category=research')->assertOk();
    $header = IOFactory::load($response->getFile()->getPathname())->getActiveSheet()->toArray()[0];

    expect($header)->toContain('College')->not->toContain('college_id')->not->toContain('College Id');
});

test('saving a version keeps the filters it was saved with', function () {
    $this->actingAs($this->central, 'sanctum')
        ->postJson('/api/v1/reports/generate', ['type' => 'proposal_count_by_category', 'filters' => ['academic_year' => '2025-2026']])
        ->assertOk();

    $snapshot = ReportSnapshot::first();
    expect($snapshot->filters)->toBe(['academic_year' => '2025-2026'])
        ->and(collect($snapshot->result)->sum('total'))->toBe(1);
});

test('unknown reports and people without report access are refused', function () {
    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/reports/live/everything')->assertNotFound();

    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $this->actingAs($pi, 'sanctum')->getJson('/api/v1/reports/live/proposal_count_by_category')->assertForbidden();
});

test('college performance counts research outputs for the chosen year only', function () {
    $current = ($this->make)($this->collegeA, 'research', '2026-2027', 'funded');
    $older = ($this->make)($this->collegeA, 'research', '2025-2026', 'funded');
    foreach ([[$current, 'journal_article'], [$current, 'conference_paper'], [$older, 'journal_article']] as [$proposal, $type]) {
        ResearchOutput::create([
            'proposal_id' => $proposal->id, 'output_type' => $type, 'title' => 'Output '.rand(),
            'recorded_by' => $this->central->id, 'status' => 'approved',
        ]);
    }

    $alpha = fn ($q) => collect($this->actingAs($this->central, 'sanctum')->getJson('/api/v1/reports/live/college_performance'.$q)->json('data'))
        ->firstWhere('college_name', 'Alpha College');

    expect((int) $alpha('?academic_year=2026-2027')['outputs_produced'])->toBe(2)
        ->and((int) $alpha('?academic_year=2026-2027')['publications_count'])->toBe(1)
        ->and((int) $alpha('')['outputs_produced'])->toBe(3);
});
