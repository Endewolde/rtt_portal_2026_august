<?php

use App\Models\AuditLog;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Support\AuditLogger;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function atc_user(string $role): User
{
    $user = User::factory()->create(['status' => 'active']);
    $user->assignRole($role);

    return $user;
}

test('a refused change is recorded as denied, with what was attempted and the request', function () {
    $staff = atc_user('staff');

    $this->actingAs($staff, 'sanctum')->postJson('/api/v1/external-funds/agencies', ['name' => 'Sneaky', 'type' => 'ngo'])->assertForbidden();

    $log = AuditLog::where('event', 'external_fund.denied')->where('actor_id', $staff->id)->firstOrFail();
    expect($log->new_values['attempted'])->toBe('external_fund.created')
        ->and($log->method)->toBe('POST')
        ->and($log->url)->toBe('/api/v1/external-funds/agencies')
        ->and($log->status_code)->toBe(403);
});

test('a successful change records the method, address and outcome, never the password', function () {
    $admin = atc_user('super_admin');

    $this->actingAs($admin, 'sanctum')->postJson('/api/v1/external-funds/agencies', ['name' => 'Gates', 'type' => 'foundation', 'secret' => 'x'])->assertCreated();

    $log = AuditLog::where('event', 'external_fund.created')->firstOrFail();
    expect($log->status_code)->toBe(201)
        ->and($log->new_values['name'])->toBe('Gates')
        ->and($log->new_values)->not->toHaveKey('secret');
});

test('exports are recorded, including exports of the audit log itself', function () {
    $admin = atc_user('super_admin');

    $this->actingAs($admin, 'sanctum')->get('/api/v1/audit-logs/export?category=security')->assertOk()->streamedContent();

    $log = AuditLog::where('event', 'audit_logs.exported')->where('actor_id', $admin->id)->firstOrFail();
    expect($log->method)->toBe('GET')
        ->and($log->new_values['category'])->toBe('security');
});

test('failed sign-ins, unknown emails and the lockout are all recorded', function () {
    $user = User::factory()->create(['email' => 'pi@example.com', 'password' => Hash::make('right-password'), 'status' => 'active', 'email_verified_at' => now()]);

    $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'whatever'])->assertUnprocessable();
    foreach (range(1, 5) as $_) {
        $this->postJson('/api/v1/auth/login', ['email' => 'pi@example.com', 'password' => 'wrong'])->assertUnprocessable();
    }
    $this->postJson('/api/v1/auth/login', ['email' => 'pi@example.com', 'password' => 'right-password'])->assertUnprocessable();

    expect(AuditLog::where('event', 'user.login_failed')->where('auditable_id', 'unknown')->first()->new_values['email'])->toBe('nobody@example.com')
        ->and(AuditLog::where('event', 'user.login_failed')->where('auditable_id', $user->id)->count())->toBe(5)
        ->and(AuditLog::where('event', 'user.account_locked')->where('auditable_id', $user->id)->exists())->toBeTrue()
        ->and(AuditLog::where('event', 'user.login_blocked')->where('auditable_id', $user->id)->exists())->toBeTrue()
        ->and(AuditLog::whereRaw('new_values like ?', ['%wrong%'])->exists())->toBeFalse();
});

test('super-admin activity stays off the screen, and the security tab finds denied attempts', function () {
    $super = atc_user('super_admin');
    $admin = atc_user('admin');
    $staff = atc_user('staff');

    $this->actingAs($super, 'sanctum')->postJson('/api/v1/external-funds/agencies', ['name' => 'By super', 'type' => 'ngo'])->assertCreated();
    $this->actingAs($staff, 'sanctum')->postJson('/api/v1/external-funds/agencies', ['name' => 'By staff', 'type' => 'ngo'])->assertForbidden();

    // Recorded…
    expect(AuditLog::where('actor_id', $super->id)->where('event', 'external_fund.created')->exists())->toBeTrue();

    // …but not listed.
    $forAdmin = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/audit-logs')->assertOk();
    expect(collect($forAdmin->json('data.data'))->pluck('actor_id'))->not->toContain($super->id);

    $security = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/audit-logs?category=security')->assertOk();
    expect(collect($security->json('data.data'))->pluck('event')->all())->toBe(['external_fund.denied'])
        ->and($security->json('meta.stats.denied_30d'))->toBe(1);
});

test('entries read as plain sentences with names and titles instead of IDs', function () {
    $admin = atc_user('admin');
    $officer = atc_user('research_officer');
    $officer->update(['name' => 'Almaz Tesfaye', 'email' => 'almaz@uni.edu']);
    $reviewer = User::factory()->create(['name' => 'Dawit Bekele', 'email' => 'dawit@uni.edu']);
    $college = College::create(['name' => 'Agriculture', 'code' => 'AG'.rand(1000, 9999)]);
    $department = Department::create(['name' => 'Soil Science', 'code' => 'SS'.rand(1000, 9999), 'college_id' => $college->id]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'atc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'AT-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'Soil health in Wolaita',
        'status' => 'submitted', 'pi_user_id' => $reviewer->id, 'college_id' => $college->id, 'department_id' => $department->id,
        'academic_year' => '2026', 'created_by' => $reviewer->id,
    ]);

    AuditLogger::log('proposal.assigned', 'Proposal', $proposal->id, $officer->id, null, ['reviewer_id' => $reviewer->id, 'status' => 'under_review']);

    $entry = $this->actingAs($admin, 'sanctum')->getJson("/api/v1/audit-logs?actor_id={$officer->id}")->assertOk()->json('data.data.0');

    expect($entry['description'])->toBe('Almaz Tesfaye assigned a reviewer to the proposal “Soil Health in Wolaita”')
        ->and($entry['subject'])->toBe(['type' => 'proposal', 'name' => '“Soil Health in Wolaita”'])
        ->and($entry['changes'])->toContain(['field' => 'Reviewer', 'from' => null, 'to' => 'Dawit Bekele (dawit@uni.edu)'])
        ->and($entry['changes'])->toContain(['field' => 'Status', 'from' => null, 'to' => 'Under review'])
        ->and(json_encode($entry['changes']))->not->toContain($reviewer->id);

    // Searching by the proposal's title finds what was done to it.
    $found = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/audit-logs?q=Soil+health')->assertOk()->json('data.data');
    expect(collect($found)->pluck('event'))->toContain('proposal.assigned');
});
