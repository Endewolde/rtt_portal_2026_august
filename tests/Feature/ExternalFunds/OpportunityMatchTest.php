<?php

use App\Models\ExternalFundAgency;
use App\Models\ExternalFundOpportunity;
use App\Models\User;
use App\Services\OpportunityMatchService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->manager = User::factory()->create();
    $this->manager->assignRole('central_officer');
    $this->agency = ExternalFundAgency::create(['name' => 'Water Foundation', 'acronym' => 'WF', 'type' => 'foundation', 'is_active' => true, 'created_by' => $this->manager->id]);
    $this->water = User::factory()->create(['expertise' => ['Water Resources', 'Irrigation'], 'status' => 'active']);
    $this->ai = User::factory()->create(['expertise' => ['AI', 'Machine Learning'], 'status' => 'active']);

    $this->open = fn (array $overrides = []) => ExternalFundOpportunity::create($overrides + [
        'agency_id' => $this->agency->id, 'title' => 'Small-scale irrigation and water resources grants',
        'category' => 'research', 'type' => 'grant', 'description' => 'Supports irrigation research in rural Ethiopia.',
        'deadline' => now()->addMonth()->toDateString(), 'status' => 'open', 'created_by' => $this->manager->id,
    ]);
});

test('researchers see open opportunities that match their expertise, with the reason', function () {
    ($this->open)();
    ($this->open)(['title' => 'Closed irrigation call', 'status' => 'closed']);

    $this->actingAs($this->water, 'sanctum')->getJson('/api/v1/external-funds/opportunities/recommended')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.title', 'Small-scale irrigation and water resources grants')
        ->assertJsonPath('data.0.reasons.0', 'water resources');

    $this->actingAs($this->ai, 'sanctum')->getJson('/api/v1/external-funds/opportunities/recommended')->assertJsonCount(0, 'data');
});

test('short terms like "AI" only match as whole words', function () {
    ($this->open)(['title' => 'Grants for AI in agriculture', 'description' => 'Machine learning for crops.']);
    ($this->open)(['title' => 'Maintenance of rural water points', 'description' => 'Repairs and training.']);

    $titles = collect(app(OpportunityMatchService::class)->forUser($this->ai))->map(fn ($m) => $m['opportunity']->title)->all();

    expect($titles)->toBe(['Grants for AI in agriculture']);
});

test('opening an opportunity alerts matching researchers once', function () {
    $this->actingAs($this->manager, 'sanctum')->postJson('/api/v1/external-funds/opportunities', [
        'agency_id' => $this->agency->id, 'title' => 'Irrigation innovation fund', 'category' => 'research', 'type' => 'grant',
        'description' => 'Water resources and irrigation.', 'deadline' => now()->addMonth()->toDateString(), 'status' => 'open',
    ])->assertCreated();

    $opportunity = ExternalFundOpportunity::where('title', 'Irrigation innovation fund')->first();
    expect(DB::table('notifications')->where('notifiable_id', $this->water->id)->where('type', 'opportunity_match')->count())->toBe(1)
        ->and(DB::table('notifications')->where('notifiable_id', $this->ai->id)->exists())->toBeFalse()
        ->and($opportunity->match_alerts_sent_at)->not->toBeNull();

    $this->putJson("/api/v1/external-funds/opportunities/{$opportunity->id}", ['title' => 'Irrigation innovation fund 2'])->assertOk();
    expect(DB::table('notifications')->where('notifiable_id', $this->water->id)->where('type', 'opportunity_match')->count())->toBe(1);
});
