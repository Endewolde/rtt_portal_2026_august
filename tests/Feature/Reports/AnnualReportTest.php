<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::create(['name' => 'Annual College', 'code' => 'AR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'ARD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'ar-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);

    foreach (['funded', 'midterm_evaluation', 'completed', 'rejected', 'under_blind_review', 'draft'] as $status) {
        $pi = User::factory()->create();
        Proposal::create([
            'tracker_number' => 'AR-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
            'title' => 'Annual '.$status, 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => '2026-2027', 'created_by' => $pi->id,
        ]);
    }
});

test('the annual report counts every funded project, including those at mid-term or completed', function () {
    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/annual-report/preview?academic_year=2026-2027')->assertOk();

    expect($response->json('data.proposals.total'))->toBe(5)
        ->and($response->json('data.proposals.funded'))->toBe(3)
        ->and($response->json('data.colleges.0.submitted'))->toBe(5)
        ->and($response->json('data.colleges.0.funded'))->toBe(3)
        ->and($response->json('meta.academic_years'))->toBe(['2026-2027']);
});
