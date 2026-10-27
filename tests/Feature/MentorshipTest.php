<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Mentorship;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $college = College::create(['name' => 'Mentor College', 'code' => 'MN'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'MND'.rand(10000, 99999)]);
    $admin = User::factory()->create();
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'mn-'.rand(10000, 99999),
        'start_date' => now(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);
    $this->propose = fn (User $pi, string $status, string $keywords = '') => Proposal::create([
        'tracker_number' => 'MN-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'Mentor '.rand(),
        'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026-2027', 'created_by' => $pi->id, 'keywords' => $keywords,
    ]);

    $this->senior = User::factory()->create(['name' => 'Senior Researcher', 'expertise' => ['Irrigation', 'Soil Science'], 'status' => 'active']);
    ($this->propose)($this->senior, 'completed');
    $this->junior = User::factory()->create(['expertise' => ['Irrigation'], 'status' => 'active']);
    $this->draft = ($this->propose)($this->junior, 'draft', 'irrigation');
});

test('only people who led a funded project can offer to mentor', function () {
    $this->actingAs($this->junior, 'sanctum')->putJson('/api/v1/mentorships/settings', ['mentor_available' => true])->assertUnprocessable();
    $this->actingAs($this->senior, 'sanctum')->putJson('/api/v1/mentorships/settings', ['mentor_available' => true, 'mentor_note' => 'Happy to help with budgets.'])->assertOk();

    expect($this->senior->fresh()->mentor_available)->toBeTrue();
});

test('a junior researcher finds a matching mentor, asks, and the mentor accepts', function () {
    $this->senior->update(['mentor_available' => true]);

    $this->actingAs($this->junior, 'sanctum')->getJson('/api/v1/mentors')
        ->assertOk()->assertJsonPath('data.0.name', 'Senior Researcher')->assertJsonPath('data.0.shared.0', 'Irrigation');

    $this->postJson('/api/v1/mentorships', ['mentor_id' => $this->senior->id, 'proposal_id' => $this->draft->id, 'message' => 'Could you advise on my irrigation proposal?'])
        ->assertCreated();
    $this->postJson('/api/v1/mentorships', ['mentor_id' => $this->senior->id, 'message' => 'Asking a second time, please.'])->assertUnprocessable();
    expect(DB::table('notifications')->where('notifiable_id', $this->senior->id)->where('type', 'mentorship_requested')->exists())->toBeTrue();

    $mentorship = Mentorship::first();
    $this->actingAs($this->senior, 'sanctum')->postJson("/api/v1/mentorships/{$mentorship->id}/respond", ['accept' => true, 'response' => 'Glad to.'])->assertOk();

    expect($mentorship->fresh()->status)->toBe('active')
        ->and(DB::table('notifications')->where('notifiable_id', $this->junior->id)->where('type', 'mentorship_accepted')->exists())->toBeTrue();
    $this->actingAs($this->junior, 'sanctum')->getJson("/api/v1/proposals/{$this->draft->id}/mentor")->assertJsonPath('data.name', 'Senior Researcher');
});

test('only the mentor answers, and either side can end it', function () {
    $this->senior->update(['mentor_available' => true]);
    $mentorship = Mentorship::create(['mentee_id' => $this->junior->id, 'mentor_id' => $this->senior->id, 'status' => 'requested', 'message' => 'Please help me.']);

    $this->actingAs($this->junior, 'sanctum')->postJson("/api/v1/mentorships/{$mentorship->id}/respond", ['accept' => true])->assertNotFound();
    $this->postJson("/api/v1/mentorships/{$mentorship->id}/end")->assertOk();
    expect($mentorship->fresh()->status)->toBe('ended');
});

test('you cannot link someone else’s proposal or ask an unavailable mentor', function () {
    $other = User::factory()->create();
    $theirs = ($this->propose)($other, 'draft');
    $this->senior->update(['mentor_available' => true]);

    $this->actingAs($this->junior, 'sanctum')
        ->postJson('/api/v1/mentorships', ['mentor_id' => $this->senior->id, 'proposal_id' => $theirs->id, 'message' => 'Linking a proposal that is not mine.'])
        ->assertUnprocessable();

    $this->senior->update(['mentor_available' => false]);
    $this->postJson('/api/v1/mentorships', ['mentor_id' => $this->senior->id, 'message' => 'Hello, could you help me please?'])->assertUnprocessable();
});
