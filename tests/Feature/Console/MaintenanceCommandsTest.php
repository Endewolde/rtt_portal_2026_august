<?php

use App\Models\AuditLog;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── users:deactivate-expired-guests ────────────────────────────────────────

test('deactivates a guest account older than two weeks and revokes its tokens', function () {
    $guest = User::factory()->create(['status' => 'active', 'created_at' => now()->subWeeks(3)]);
    $guest->assignRole('guest');
    $token = $guest->createToken('test')->plainTextToken;

    Artisan::call('users:deactivate-expired-guests');

    expect($guest->fresh()->status)->toBe('inactive')
        ->and($guest->fresh()->tokens()->count())->toBe(0)
        ->and(AuditLog::where('auditable_id', $guest->id)->where('event', 'user.auto_deactivated')->exists())->toBeTrue();
});

test('leaves a recently-created guest account untouched', function () {
    $guest = User::factory()->create(['status' => 'active', 'created_at' => now()->subDays(3)]);
    $guest->assignRole('guest');

    Artisan::call('users:deactivate-expired-guests');

    expect($guest->fresh()->status)->toBe('active');
});

test('leaves a non-guest account untouched even if old', function () {
    $staff = User::factory()->create(['status' => 'active', 'created_at' => now()->subWeeks(3)]);
    $staff->assignRole('staff');

    Artisan::call('users:deactivate-expired-guests');

    expect($staff->fresh()->status)->toBe('active');
});

// ─── rtt:cleanup-telegram-tokens ─────────────────────────────────────────────

test('clears an expired telegram link token but leaves a valid one alone', function () {
    $expiredUser = User::factory()->create([
        'telegram_link_token' => 'expired-token',
        'telegram_link_token_expires_at' => now()->subHour(),
    ]);
    $validUser = User::factory()->create([
        'telegram_link_token' => 'valid-token',
        'telegram_link_token_expires_at' => now()->addHour(),
    ]);

    Artisan::call('rtt:cleanup-telegram-tokens');

    expect($expiredUser->fresh()->telegram_link_token)->toBeNull()
        ->and($expiredUser->fresh()->telegram_link_token_expires_at)->toBeNull()
        ->and($validUser->fresh()->telegram_link_token)->toBe('valid-token');
});

// ─── cache:warm-dashboard ────────────────────────────────────────────────────

test('warms the dashboard cache for every active, verified user without error', function () {
    $active = User::factory()->create(['status' => 'active', 'email_verified_at' => now()]);
    $active->assignRole('staff');
    $unverified = User::factory()->create(['status' => 'active', 'email_verified_at' => null]);
    $unverified->assignRole('staff');
    $inactive = User::factory()->create(['status' => 'inactive', 'email_verified_at' => now()]);
    $inactive->assignRole('staff');

    $exitCode = Artisan::call('cache:warm-dashboard');

    expect($exitCode)->toBe(0)
        ->and(Artisan::output())->toContain('Warming dashboard cache for 1 users');
});

// ─── similarity:backfill ─────────────────────────────────────────────────────

test('backfill scores every non-draft proposal without a similarity score yet', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $college = College::create(['name' => 'Sim College '.rand(), 'code' => 'SIM'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'SIMD'.rand(10, 99)]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'sim-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    $draft = Proposal::create([
        'tracker_number' => 'SIM-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Draft one', 'abstract' => 'Something about lasers', 'status' => 'draft',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
    $submitted = Proposal::create([
        'tracker_number' => 'SIM-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Submitted one', 'abstract' => 'Something about photonics', 'status' => 'submitted',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
    // A second non-draft proposal in the same category — check() has nothing to
    // compare against (and writes nothing) when it's the only one in its category.
    Proposal::create([
        'tracker_number' => 'SIM-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Another submitted one', 'abstract' => 'Something about optics', 'status' => 'submitted',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $exitCode = Artisan::call('similarity:backfill');

    expect($exitCode)->toBe(0)
        ->and(DB::table('similarity_scores')->where('proposal_id', $submitted->id)->exists())->toBeTrue()
        ->and(DB::table('similarity_scores')->where('proposal_id', $draft->id)->exists())->toBeFalse();
});
