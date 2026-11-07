<?php

use App\Models\Innovation;
use App\Models\InnovationIncome;
use App\Models\Partnership;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create(['status' => 'active']);
    $this->admin->assignRole('admin');
    $this->director = User::factory()->create(['status' => 'active']);
    $this->director->assignRole('technology_officer');
});

test('targets are set per year and shown beside the actuals counted in that year', function () {
    Partnership::create(['partner_name' => 'A', 'partner_type' => 'ngo', 'agreement_type' => 'mou', 'signed_on' => '2025-10-01']);
    Partnership::create(['partner_name' => 'B', 'partner_type' => 'ngo', 'agreement_type' => 'mou', 'signed_on' => '2025-08-31']); // previous year
    $inv = Innovation::create(['title' => 'X', 'ip_type' => 'patent', 'stage' => 'filed', 'filing_number' => '1', 'filed_on' => '2026-02-01']);
    InnovationIncome::create(['innovation_id' => $inv->id, 'amount' => 50000, 'currency' => 'ETB', 'received_on' => '2026-03-01', 'source' => 'licence_fee']);
    InnovationIncome::create(['innovation_id' => $inv->id, 'amount' => 900, 'currency' => 'USD', 'received_on' => '2026-03-01', 'source' => 'royalty']);

    $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/insights/targets', [
        'academic_year' => '2025-2026', 'targets' => ['partnerships_signed' => 4, 'innovation_income' => 40000, 'not_a_metric' => 9],
    ])->assertOk();

    $metrics = collect($this->actingAs($this->director, 'sanctum')->getJson('/api/v1/insights/targets?academic_year=2025-2026')->assertOk()
        ->assertJsonPath('data.can_manage', false)->json('data.metrics'))->keyBy('key');

    expect($metrics['partnerships_signed'])->toMatchArray(['actual' => 1, 'target' => 4, 'progress' => 25])
        ->and($metrics['innovation_income'])->toMatchArray(['actual' => 50000, 'status' => 'met'])
        ->and($metrics['patents_filed']['actual'])->toEqual(1)
        ->and($metrics['conferences_held']['status'])->toBe('no_target');
});

test('clearing a target removes it, and only those allowed can set targets', function () {
    $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/insights/targets', ['academic_year' => '2025-2026', 'targets' => ['patents_filed' => 3]])->assertOk();
    $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/insights/targets', ['academic_year' => '2025-2026', 'targets' => ['patents_filed' => null]])->assertOk()
        ->assertJsonPath('data.metrics.4.target', null);

    $this->actingAs($this->director, 'sanctum')->putJson('/api/v1/insights/targets', ['academic_year' => '2025-2026', 'targets' => ['patents_filed' => 3]])->assertForbidden();
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff, 'sanctum')->getJson('/api/v1/insights/targets')->assertForbidden();
});
