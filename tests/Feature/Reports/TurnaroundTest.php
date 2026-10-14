<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Cache::flush();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->collegeA = College::create(['name' => 'College A', 'code' => 'TA'.rand(10000, 99999)]);
    $this->collegeB = College::create(['name' => 'College B', 'code' => 'TB'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $this->collegeA->id, 'name' => 'D', 'code' => 'TD'.rand(10000, 99999)]);
    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'ta-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
});

/** A proposal whose history is the given [stage => days ago] entries (last = current stage). */
function ta_proposal(object $ctx, array $history, ?College $college = null): Proposal
{
    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $current = array_key_last($history);

    $proposal = Proposal::create([
        'tracker_number' => 'TA-'.rand(100000, 999999), 'proposal_call_id' => $ctx->call->id, 'category' => 'research',
        'title' => 'P', 'status' => $current, 'pi_user_id' => $pi->id, 'college_id' => ($college ?? $ctx->collegeA)->id,
        'department_id' => $ctx->dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
        'status_entered_at' => now()->subDays($history[$current]),
    ]);

    $from = 'draft';
    foreach ($history as $stage => $daysAgo) {
        DB::table('workflow_logs')->insert([
            'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id, 'from_stage' => $from, 'action' => 'x',
            'to_stage' => $stage, 'actor_id' => $ctx->central->id, 'notes' => null, 'metadata' => null,
            'created_at' => now()->subDays($daysAgo),
        ]);
        $from = $stage;
    }

    return $proposal;
}

test('time spent in each stage is measured from the workflow history', function () {
    ta_proposal($this, ['submitted' => 10, 'validated' => 7, 'under_blind_review' => 2]);

    $stages = collect($this->actingAs($this->central, 'sanctum')->getJson('/api/v1/analytics/turnaround?academic_year=2026')
        ->assertOk()->json('data.stages'))->keyBy('stage');

    expect($stages['submitted']['median'])->toEqual(3)
        ->and($stages['validated']['median'])->toEqual(5)
        ->and($stages['under_blind_review']['median'])->toEqual(2);
});

test('proposals over their stage target are listed as stuck, worst first', function () {
    ta_proposal($this, ['submitted' => 20, 'validated' => 10]);       // 3 days over (target 7)
    ta_proposal($this, ['submitted' => 30]);                           // 23 days over (target 7)
    ta_proposal($this, ['submitted' => 5, 'validated' => 2]);          // fine

    $stuck = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/analytics/turnaround?academic_year=2026')->json('data.stuck');

    expect($stuck)->toHaveCount(2)
        ->and($stuck[0]['overdue_by'])->toBe(23)
        ->and($stuck[1]['stage_label'])->toBe('Awaiting reviewers');
});

test('a college officer only sees their own college', function () {
    ta_proposal($this, ['submitted' => 30]);
    ta_proposal($this, ['submitted' => 30], $this->collegeB);
    $officer = User::factory()->create(['college_id' => $this->collegeA->id]);
    $officer->assignRole('college_officer');

    $data = $this->actingAs($officer, 'sanctum')->getJson('/api/v1/analytics/turnaround?academic_year=2026')->json('data');

    expect($data['stuck'])->toHaveCount(1)
        ->and($data['stuck'][0]['college'])->toBe('College A')
        ->and($data['colleges'])->toHaveCount(1);
});

test('remind notifies whoever has to act next, at most once a day', function () {
    $proposal = ta_proposal($this, ['submitted' => 20, 'validated' => 10]);
    $collegeOfficer = User::factory()->create(['college_id' => $this->collegeA->id]);
    $collegeOfficer->assignRole('college_officer');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/analytics/turnaround/{$proposal->id}/remind")
        ->assertOk();

    expect(DB::table('notifications')->where('notifiable_id', $collegeOfficer->id)->where('type', 'stage_reminder')->count())->toBe(1);

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/analytics/turnaround/{$proposal->id}/remind")
        ->assertStatus(429)
        ->assertJsonPath('message', 'A reminder for this stage was already sent in the last 24 hours.');
});

test('reviewer turnaround averages days to score and counts overdue reviews', function () {
    $proposal = ta_proposal($this, ['submitted' => 20, 'validated' => 15, 'under_blind_review' => 10]);
    $type = EvaluationType::create(['name' => 'blind_review_ta', 'label' => 'B', 'proposal_category' => 'research', 'is_active' => true]);
    $fast = User::factory()->create(['name' => 'Fast Reviewer']);
    $late = User::factory()->create(['name' => 'Late Reviewer']);
    ReviewAssignment::create(['proposal_id' => $proposal->id, 'reviewer_id' => $fast->id, 'evaluation_type_id' => $type->id, 'assigned_by' => $this->central->id,
        'status' => 'submitted', 'assigned_at' => now()->subDays(10), 'submitted_at' => now()->subDays(6), 'due_date' => now()->subDays(3)]);
    ReviewAssignment::create(['proposal_id' => $proposal->id, 'reviewer_id' => $late->id, 'evaluation_type_id' => $type->id, 'assigned_by' => $this->central->id,
        'status' => 'pending', 'assigned_at' => now()->subDays(10), 'due_date' => now()->subDays(3)]);

    $reviewers = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/analytics/turnaround?academic_year=2026')->json('data.reviewers');

    expect($reviewers['average_days'])->toEqual(4)
        ->and($reviewers['overdue'])->toBe(1)
        ->and($reviewers['slowest'][0]['name'])->toBe('Late Reviewer');
});

test('staff cannot open the turnaround dashboard', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->getJson('/api/v1/analytics/turnaround')->assertForbidden();
});
