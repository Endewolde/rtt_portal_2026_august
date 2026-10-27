<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Programme;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\TrackerNumberService;
use App\Support\Programmes;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Programmes::forget();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
});

test('the built-in programmes are seeded with their tracker prefixes', function () {
    expect(Programmes::keys())->toContain('research', 'community_engagement', 'technology_transfer')
        ->and(Programmes::prefix('research'))->toBe('RES')
        ->and(Programmes::label('technology_transfer'))->toBe('Technology Transfer');
});

test('an admin adds a programme with a generated key and it is shared with every page', function () {
    $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/programmes', [
        'name' => 'Postgraduate Research', 'tracker_prefix' => 'PGR', 'color' => '#ef4444',
    ])->assertCreated()->assertJsonPath('data.key', 'postgraduate_research');

    expect(Programmes::keys())->toContain('postgraduate_research')
        ->and(Programmes::label('postgraduate_research'))->toBe('Postgraduate Research');

    $this->get('/')->assertInertia(fn ($page) => $page->where('programmes', fn ($list) => collect($list)->pluck('key')->contains('postgraduate_research')));
});

test('a new programme numbers its proposals with its own prefix', function () {
    Programme::create(['key' => 'postgraduate', 'name' => 'Postgraduate', 'tracker_prefix' => 'PGR', 'color' => '#ef4444', 'is_active' => true, 'sort_order' => 9]);

    expect(app(TrackerNumberService::class)->generate('postgraduate', '2026'))->toStartWith('PGR-2026-');
});

test('tracker prefixes must be unique capital letters', function () {
    $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/programmes', ['name' => 'Duplicate', 'tracker_prefix' => 'RES'])
        ->assertUnprocessable()->assertJsonValidationErrors('tracker_prefix');

    $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/programmes', ['name' => 'Lower', 'tracker_prefix' => 'abc'])
        ->assertUnprocessable()->assertJsonValidationErrors('tracker_prefix');
});

test('people without the permission cannot change programmes', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->postJson('/api/v1/programmes', ['name' => 'Sneaky', 'tracker_prefix' => 'SNK'])->assertForbidden();
    $this->actingAs($staff, 'sanctum')->getJson('/api/v1/programmes')->assertOk();
});

test('a role scoped to a new programme becomes its director', function () {
    $programme = Programme::create(['key' => 'innovation_hub', 'name' => 'Innovation Hub', 'tracker_prefix' => 'INV', 'color' => '#f59e0b', 'is_active' => true, 'sort_order' => 9]);

    $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/roles', [
        'label' => 'Innovation Director', 'scope' => 'category', 'scope_category' => 'innovation_hub',
    ])->assertSuccessful();

    expect(Programmes::directorRoles('innovation_hub'))->toHaveCount(1);

    $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/programmes')
        ->assertOk()
        ->assertJsonFragment(['key' => $programme->key, 'director_roles' => Programmes::directorRoles('innovation_hub')]);
});

test('a switched-off programme cannot take new calls but keeps its label', function () {
    $programme = Programme::where('key', 'technology_transfer')->firstOrFail();
    $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/programmes/'.$programme->id, ['is_active' => false])->assertOk();

    expect(Programmes::keys(true))->not->toContain('technology_transfer')
        ->and(Programmes::label('technology_transfer'))->toBe('Technology Transfer');

    $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/proposal-calls', [
        'academic_year' => '2026-2027', 'category' => 'technology_transfer', 'title' => 'Closed stream',
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
    ])->assertUnprocessable()->assertJsonValidationErrors('category');
});

test('a programme in use cannot be removed, an unused one can', function () {
    $college = College::create(['name' => 'Prog College', 'code' => 'PC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'PCD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'pc-'.rand(10000, 99999),
        'start_date' => now(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->admin->id,
    ]);
    Proposal::create([
        'tracker_number' => 'RES-1', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'In use',
        'status' => 'submitted', 'pi_user_id' => $this->admin->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026-2027', 'created_by' => $this->admin->id,
    ]);

    $research = Programme::where('key', 'research')->firstOrFail();
    $this->actingAs($this->admin, 'sanctum')->deleteJson('/api/v1/programmes/'.$research->id)->assertUnprocessable();

    $unused = Programme::create(['key' => 'spare', 'name' => 'Spare', 'tracker_prefix' => 'SPR', 'color' => '#64748b', 'is_active' => true, 'sort_order' => 9]);
    $this->actingAs($this->admin, 'sanctum')->deleteJson('/api/v1/programmes/'.$unused->id)->assertOk();

    expect(Programmes::keys())->not->toContain('spare');
});
