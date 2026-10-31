<?php

use App\Models\AppSetting;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    foreach (['2024-2025', '2025-2026', '2026-2027', '2026-2027'] as $i => $year) {
        ProposalCall::create([
            'academic_year' => $year, 'category' => 'research', 'title' => "Call {$year} #{$i}", 'slug' => "pcy-{$i}-".rand(1000, 9999),
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
        ]);
    }
});

test('without a current academic year in Settings the admin list shows the latest year and lists every year to choose from', function () {
    AppSetting::where('key', 'current_academic_year')->update(['value' => null]);

    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposal-calls/all')->assertOk();

    expect($response->json('academic_year'))->toBe('2026-2027')
        ->and($response->json('academic_years'))->toBe(['2026-2027', '2025-2026', '2024-2025'])
        ->and(collect($response->json('data'))->pluck('academic_year')->unique()->values()->all())->toBe(['2026-2027'])
        ->and($response->json('data'))->toHaveCount(2);
});

test('the admin list can be narrowed to an earlier academic year or widened to all years', function () {
    $earlier = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposal-calls/all?academic_year=2024-2025')->assertOk();
    expect($earlier->json('data'))->toHaveCount(1)
        ->and($earlier->json('data.0.academic_year'))->toBe('2024-2025');

    $all = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposal-calls/all?academic_year=all')->assertOk();
    expect($all->json('data'))->toHaveCount(4)
        ->and($all->json('academic_year'))->toBe('all');
});

test('the admin list opens on the current academic year from Settings, even when a later year already has calls', function () {
    AppSetting::where('key', 'current_academic_year')->update(['value' => '2025-2026']);

    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposal-calls/all')->assertOk();

    expect($response->json('academic_year'))->toBe('2025-2026')
        ->and($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.academic_year'))->toBe('2025-2026');
});

test('the current academic year is offered even before it has any calls', function () {
    AppSetting::where('key', 'current_academic_year')->update(['value' => '2027-2028']);

    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/proposal-calls/all')->assertOk();

    expect($response->json('academic_year'))->toBe('2027-2028')
        ->and($response->json('academic_years'))->toBe(['2027-2028', '2026-2027', '2025-2026', '2024-2025'])
        ->and($response->json('data'))->toBe([]);
});
