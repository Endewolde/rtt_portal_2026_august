<?php

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function ri_proposalWithCoI(string $invitationStatus = 'declined'): array
{
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');
    $coI = User::factory()->create();
    $coI->assignRole('staff');

    $call = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => 'research',
        'title' => 'Test Call', 'slug' => 'ri-call-'.rand(10000, 99999),
        'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $pi->id,
    ]);

    $proposal = Proposal::create([
        'id' => (string) Str::uuid(),
        'tracker_number' => 'RTT-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'title' => 'Test Proposal',
        'abstract' => 'Test abstract content.',
        'status' => 'draft',
        'category' => 'research',
        'academic_year' => '2024/25',
        'created_by' => $pi->id,
    ]);

    $member = ProposalMember::create([
        'proposal_id' => $proposal->id,
        'user_id' => $coI->id,
        'role' => 'co_investigator',
        'contribution_percentage' => 20,
        'status' => 'active',
        'invitation_status' => $invitationStatus,
        'invitation_responded_at' => $invitationStatus === 'declined' ? now() : null,
        'joined_at' => now(),
    ]);

    return [$pi, $coI, $proposal, $member];
}

test('a PI can resend an invitation that was declined', function () {
    Queue::fake();
    [$pi, $coI, $proposal, $member] = ri_proposalWithCoI('declined');

    $response = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposal-members/{$member->id}/resend-invitation")
        ->assertOk();

    expect($response->json('data.invitation_status'))->toBe('pending')
        ->and($member->fresh()->invitation_responded_at)->toBeNull();

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $coI->id && $job->event === 'co_investigator_notified');
    Queue::assertPushed(StoreInAppNotificationJob::class, fn ($job) => $job->userId === $coI->id && $job->event === 'co_investigator_notified');
});

test('a non-owning user cannot resend an invitation', function () {
    [, , , $member] = ri_proposalWithCoI('declined');
    $outsider = User::factory()->create();
    $outsider->assignRole('staff');

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/proposal-members/{$member->id}/resend-invitation")
        ->assertStatus(403);
});

test('an invitation that is still pending cannot be resent', function () {
    [$pi, , , $member] = ri_proposalWithCoI('pending');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposal-members/{$member->id}/resend-invitation")
        ->assertStatus(422);
});

test('an already-accepted invitation cannot be resent', function () {
    [$pi, , , $member] = ri_proposalWithCoI('accepted');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposal-members/{$member->id}/resend-invitation")
        ->assertStatus(422);
});
