<?php

use App\Models\College;
use App\Models\Department;
use App\Models\OnboardingProgress;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    // College-scoped roles (college officer, finance officer) need a college.
    $this->collegeId = College::create(['name' => 'C'.rand(), 'code' => 'OC'.rand(10000, 99999)])->id;
});

test('first sign-in: onboarding starts for the user\'s highest role, with the welcome not yet seen', function () {
    $user = User::factory()->create(['college_id' => $this->collegeId]);
    $user->assignRole(['staff', 'college_officer']);

    $data = $this->actingAs($user, 'sanctum')->getJson('/api/v1/onboarding')->assertOk()->json('data');

    expect($data['role'])->toBe('college_officer')
        ->and($data['roles'])->toBe(['college_officer', 'staff', 'general'])
        ->and($data['welcome_seen'])->toBeFalse()
        ->and($data['completed_tours'])->toBe([])
        ->and(OnboardingProgress::where('user_id', $user->id)->count())->toBe(1);
});

test('progress is saved per role, and only for roles the user holds', function () {
    $user = User::factory()->create(['college_id' => $this->collegeId]);
    $user->assignRole(['staff', 'college_officer']);
    $this->actingAs($user, 'sanctum');

    $this->patchJson('/api/v1/onboarding', ['role' => 'college_officer', 'completed_tour' => 'college.reviews', 'welcome_seen' => true])->assertOk();
    $this->patchJson('/api/v1/onboarding', ['role' => 'staff', 'completed_tour' => 'researcher.apply'])->assertOk();

    expect($this->getJson('/api/v1/onboarding?role=college_officer')->json('data.completed_tours'))->toBe(['college.reviews'])
        ->and($this->getJson('/api/v1/onboarding?role=staff')->json('data.completed_tours'))->toBe(['researcher.apply'])
        ->and($this->getJson('/api/v1/onboarding?role=staff')->json('data.welcome_seen'))->toBeFalse();

    $this->patchJson('/api/v1/onboarding', ['role' => 'super_admin', 'welcome_seen' => true])->assertStatus(422);
    $this->getJson('/api/v1/onboarding?role=super_admin')->assertStatus(422);
});

test('a tour resumes where it stopped, and finishing it clears the bookmark', function () {
    $user = User::factory()->create();
    $user->assignRole('external_reviewer');
    $this->actingAs($user, 'sanctum');

    $this->patchJson('/api/v1/onboarding', ['role' => 'external_reviewer', 'active_tour' => 'reviewer.reviews', 'active_step' => 2])
        ->assertJsonPath('data.active_tour', 'reviewer.reviews')
        ->assertJsonPath('data.active_step', 2);

    $this->patchJson('/api/v1/onboarding', ['role' => 'external_reviewer', 'completed_tour' => 'reviewer.reviews'])
        ->assertJsonPath('data.active_tour', null)
        ->assertJsonPath('data.completed_tours', ['reviewer.reviews']);

    $this->patchJson('/api/v1/onboarding', ['role' => 'external_reviewer', 'active_tour' => '<script>'])->assertStatus(422);
});

test('checklist tasks can be ticked and unticked; skipping and restarting work', function () {
    $user = User::factory()->create(['college_id' => $this->collegeId]);
    $user->assignRole('finance_officer');
    $this->actingAs($user, 'sanctum');
    $role = 'finance_officer';

    $this->patchJson('/api/v1/onboarding', ['role' => $role, 'completed_tasks' => ['profile', 'notifications']])
        ->assertJsonPath('data.completed_tasks', ['profile', 'notifications']);
    $this->patchJson('/api/v1/onboarding', ['role' => $role, 'uncompleted_task' => 'profile'])
        ->assertJsonPath('data.completed_tasks', ['notifications']);

    $this->patchJson('/api/v1/onboarding', ['role' => $role, 'dismissed' => true])
        ->assertJsonPath('data.dismissed', true)
        ->assertJsonPath('data.welcome_seen', true);

    $this->postJson('/api/v1/onboarding/reset', ['role' => $role])
        ->assertOk()
        ->assertJsonPath('data.dismissed', false)
        ->assertJsonPath('data.welcome_seen', false)
        ->assertJsonPath('data.completed_tasks', []);
});

test('the checklist sees what the user has actually done', function () {
    $user = User::factory()->create(['phone' => null]);
    $user->assignRole('staff');
    $this->actingAs($user, 'sanctum');

    $signals = $this->getJson('/api/v1/onboarding')->json('data.signals');
    expect($signals['proposal_submitted'])->toBeFalse()
        ->and($signals['profile_complete'])->toBeFalse();

    $college = College::create(['name' => 'C'.rand(), 'code' => 'OB'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'OD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'ob-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $user->id,
    ]);
    Proposal::create([
        'tracker_number' => 'OB-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'P',
        'status' => 'submitted', 'pi_user_id' => $user->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026', 'created_by' => $user->id,
    ]);
    $user->update(['phone' => '0911000000', 'title' => 'Dr.', 'department_id' => $dept->id]);

    $signals = $this->getJson('/api/v1/onboarding')->json('data.signals');
    expect($signals['proposal_started'])->toBeTrue()
        ->and($signals['proposal_submitted'])->toBeTrue()
        ->and($signals['profile_complete'])->toBeTrue();
});

test('onboarding needs a signed-in user', function () {
    $this->getJson('/api/v1/onboarding')->assertUnauthorized();
});
