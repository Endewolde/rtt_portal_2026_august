<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::create(['name' => 'Search College', 'code' => 'SC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'SCD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'sc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);

    $make = function (string $tracker, string $title, string $status) use ($college, $dept, $call) {
        $pi = User::factory()->create();

        return Proposal::create([
            'tracker_number' => $tracker, 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => $title,
            'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id, 'department_id' => $dept->id,
            'academic_year' => '2026-2027', 'created_by' => $pi->id,
        ]);
    };

    $this->soil = $make('RES-2026-2027-000101', 'Soil health in Wolaita', 'funded');
    $this->water = $make('RES-2026-2027-000202', 'Clean water access', 'completed');
    $this->maize = $make('RES-2026-2027-000303', 'Maize yield study', 'under_open_defence');
});

test('the proposal list searches tracker numbers as well as titles', function () {
    $this->actingAs($this->central, 'sanctum');

    expect(collect($this->getJson('/api/v1/proposals?search=000202')->json('data.data'))->pluck('id')->all())->toBe([$this->water->id])
        ->and(collect($this->getJson('/api/v1/proposals?search=Soil')->json('data.data'))->pluck('id')->all())->toBe([$this->soil->id]);
});

test('the headline card filters list the same proposals the statistics count', function () {
    $this->actingAs($this->central, 'sanctum');

    $funded = $this->getJson('/api/v1/proposals?status=funded,midterm_evaluation,completed,archived')->json('data.data');
    $review = $this->getJson('/api/v1/proposals?status=under_blind_review,under_open_defence,accepted')->json('data.data');
    $totals = $this->getJson('/api/v1/proposals/statistics')->json('data.totals');

    expect(count($funded))->toBe($totals['funded'])->toBe(2)
        ->and(count($review))->toBe($totals['under_review'])->toBe(1);
});

test('the Excel export follows the search box like the list does', function () {
    $response = $this->actingAs($this->central, 'sanctum')->get('/api/v1/reports/proposals/export?search=000202')->assertOk();
    $sheet = IOFactory::load($response->getFile()->getPathname())->getActiveSheet();
    $content = collect($sheet->toArray())->flatten()->implode(' ');

    expect($content)->toContain('RES-2026-2027-000202')->not->toContain('RES-2026-2027-000101');
});
