<?php

use App\Models\College;
use App\Models\DataDeletionRequest;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\PersonalDataService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
    $this->person = User::factory()->create(['name' => 'Abebe Kebede', 'phone' => '+251911000000']);
    $this->person->assignRole('staff');
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'pd-'.rand(10000, 99999),
        'start_date' => now()->subMonths(3)->toDateString(), 'end_date' => now()->subMonths(2)->toDateString(),
        'status' => 'expired', 'is_open' => false, 'created_by' => $this->admin->id,
    ]);
    $this->proposal = fn (string $status, array $extra = []) => Proposal::create($extra + [
        'tracker_number' => ($status === 'draft' ? 'DRAFT-' : 'RES-').rand(10000, 99999), 'proposal_call_id' => $call->id,
        'pi_user_id' => $this->person->id, 'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'My Study',
        'status' => $status, 'category' => 'research', 'academic_year' => '2026', 'created_by' => $this->person->id,
    ]);
});

function pd_setting(string $key, string $value): void
{
    DB::table('app_settings')->updateOrInsert(['key' => $key], ['id' => (string) Str::uuid(), 'value' => $value, 'type' => 'number', 'group' => 'audit']);
}

test('a person can download their own data', function () {
    ($this->proposal)('completed');

    $response = $this->actingAs($this->person, 'sanctum')->get('/api/v1/me/data-export')->assertOk();
    $data = json_decode($response->streamedContent(), true);

    expect($data['profile']['name'])->toBe('Abebe Kebede')
        ->and($data['proposals_as_pi'][0]['title'])->toBe('My Study');
});

test('approving a deletion anonymises the account but keeps the proposal records', function () {
    $completed = ($this->proposal)('completed');
    $this->actingAs($this->person, 'sanctum')->postJson('/api/v1/me/deletion-request', ['reason' => 'Leaving the university'])->assertOk();
    $request = DataDeletionRequest::first();

    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/data-deletion-requests/{$request->id}/approve")->assertOk();

    $person = $this->person->fresh();
    expect($person->name)->toBe('Deleted User')
        ->and($person->phone)->toBeNull()
        ->and($person->email)->toEndWith('@deleted.invalid')
        ->and($person->status)->toBe('inactive')
        ->and($completed->fresh()->pi_user_id)->toBe($person->id)
        ->and($request->fresh()->status)->toBe('approved');
});

test('someone with an active proposal cannot be removed yet', function () {
    ($this->proposal)('under_blind_review');
    $this->actingAs($this->person, 'sanctum')->postJson('/api/v1/me/deletion-request')->assertOk();
    $request = DataDeletionRequest::first();

    $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/data-deletion-requests')
        ->assertJsonPath('data.0.blockers.0', fn ($b) => str_starts_with($b, 'On proposals still in progress'));
    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/data-deletion-requests/{$request->id}/approve")->assertStatus(422);

    expect($this->person->fresh()->name)->toBe('Abebe Kebede');
});

test('only admins handle deletion requests', function () {
    $this->actingAs($this->person, 'sanctum')->getJson('/api/v1/admin/data-deletion-requests')->assertForbidden();
});

test('retention does nothing until configured, then removes only expired drafts', function () {
    $stale = ($this->proposal)('draft');
    expect(app(PersonalDataService::class)->applyRetention())->toBe(['drafts' => 0, 'notifications' => 0, 'accounts' => 0]);

    pd_setting('retention_draft_days', '30');
    $result = app(PersonalDataService::class)->applyRetention();

    expect($result['drafts'])->toBe(1)
        ->and(Proposal::find($stale->id))->toBeNull()
        ->and(Proposal::withTrashed()->find($stale->id))->not->toBeNull();
});

test('unused accounts are deactivated, never admins', function () {
    pd_setting('retention_inactive_account_days', '365');
    $this->person->forceFill(['last_activity_at' => now()->subYears(2)])->save();
    $this->admin->forceFill(['last_activity_at' => now()->subYears(2)])->save();

    app(PersonalDataService::class)->applyRetention();

    expect($this->person->fresh()->status)->toBe('inactive')
        ->and($this->admin->fresh()->status)->toBe('active');
});
