<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Models\User;
use App\Services\ProposalService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function ec_proposal(bool $required = true, ?string $status = null, string $category = 'research'): array
{
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $admin = User::factory()->create();
    $call = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => $category,
        'title' => 'Test Call', 'slug' => 'ec-call-'.rand(10000, 99999),
        'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
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
        'category' => $category,
        'academic_year' => '2024/25',
        'created_by' => $pi->id,
        'ethical_clearance_required' => $required,
        'ethical_clearance_status' => $status,
    ]);

    return [$pi, $proposal];
}

function ec_uploadCertificate(Proposal $proposal): ProposalDocument
{
    return ProposalDocument::create([
        'proposal_id' => $proposal->id,
        'document_type' => 'ethical_clearance_certificate',
        'is_current' => true,
        'original_filename' => 'certificate.pdf',
        'stored_path' => 'proposals/'.$proposal->id.'/documents/certificate.pdf',
        'file_size' => 1024,
        'mime_type' => 'application/pdf',
        'uploaded_by' => $proposal->pi_user_id,
    ]);
}

// ─── ProposalService::saveStep() status initialization ─────────────────────────

test('flagging a proposal as requiring clearance initializes status to pending', function () {
    [$pi, $proposal] = ec_proposal(required: false);

    app(ProposalService::class)->saveStep($proposal, 1, ['ethical_clearance_required' => true], $pi);

    expect($proposal->fresh()->ethical_clearance_status)->toBe('pending');
});

test('unflagging a proposal clears its clearance status', function () {
    [$pi, $proposal] = ec_proposal(required: true, status: 'pending');

    app(ProposalService::class)->saveStep($proposal, 1, ['ethical_clearance_required' => false], $pi);

    expect($proposal->fresh()->ethical_clearance_status)->toBeNull();
});

// ─── submit() ────────────────────────────────────────────────────────────────

test('PI can submit clearance details once a certificate is uploaded', function () {
    [$pi, $proposal] = ec_proposal(required: true, status: 'pending');
    ec_uploadCertificate($proposal);

    $res = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/submit", [
            'clearance_number' => 'EC-2026-001',
            'expiry_date' => now()->addYear()->toDateString(),
        ]);

    $res->assertOk()->assertJsonPath('data.ethical_clearance_status', 'submitted');
    expect($proposal->fresh()->ethical_clearance_number)->toBe('EC-2026-001');
});

test('cannot submit without uploading a certificate first', function () {
    [$pi, $proposal] = ec_proposal(required: true, status: 'pending');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/submit", [
            'clearance_number' => 'EC-2026-001',
            'expiry_date' => now()->addYear()->toDateString(),
        ])
        ->assertStatus(422);
});

test('cannot submit when the proposal is not flagged as requiring clearance', function () {
    [$pi, $proposal] = ec_proposal(required: false);
    ec_uploadCertificate($proposal);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/submit", [
            'clearance_number' => 'EC-2026-001',
            'expiry_date' => now()->addYear()->toDateString(),
        ])
        ->assertStatus(422);
});

test('cannot submit while a previous submission is still awaiting review', function () {
    [$pi, $proposal] = ec_proposal(required: true, status: 'submitted');
    ec_uploadCertificate($proposal);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/submit", [
            'clearance_number' => 'EC-2026-002',
            'expiry_date' => now()->addYear()->toDateString(),
        ])
        ->assertStatus(422);
});

test('a non-owning PI cannot submit clearance details for someone else\'s proposal', function () {
    [, $proposal] = ec_proposal(required: true, status: 'pending');
    ec_uploadCertificate($proposal);
    $outsider = User::factory()->create();
    $outsider->assignRole('staff');

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/submit", [
            'clearance_number' => 'EC-2026-001',
            'expiry_date' => now()->addYear()->toDateString(),
        ])
        ->assertStatus(403);
});

test('a rejected clearance can be resubmitted', function () {
    [$pi, $proposal] = ec_proposal(required: true, status: 'rejected');
    ec_uploadCertificate($proposal);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/submit", [
            'clearance_number' => 'EC-2026-003',
            'expiry_date' => now()->addYear()->toDateString(),
        ])
        ->assertOk()
        ->assertJsonPath('data.ethical_clearance_status', 'submitted');
});

// ─── index() ───────────────────────────────────────────────────────────────────

test('a reviewer cannot list ethical clearances', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/ethical-clearances')
        ->assertStatus(403);
});

test('an officer sees only clearances in their own category', function () {
    [, $researchProposal] = ec_proposal(required: true, status: 'submitted', category: 'research');
    [, $communityProposal] = ec_proposal(required: true, status: 'submitted', category: 'community_engagement');

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')->getJson('/api/v1/ethical-clearances')->assertOk();
    $ids = collect($response->json('data.data'))->pluck('id');

    expect($ids)->toContain($researchProposal->id)
        ->and($ids)->not->toContain($communityProposal->id);
});

test('the index response includes the current certificate document for the officer to review', function () {
    [, $proposal] = ec_proposal(required: true, status: 'submitted');
    $cert = ec_uploadCertificate($proposal);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $response = $this->actingAs($officer, 'sanctum')->getJson('/api/v1/ethical-clearances')->assertOk();
    $found = collect($response->json('data.data'))->firstWhere('id', $proposal->id);

    expect(collect($found['documents'])->pluck('id'))->toContain($cert->id);
});

// ─── approve() / reject() ────────────────────────────────────────────────────

test('an officer can approve a submitted clearance', function () {
    Queue::fake();
    [$pi, $proposal] = ec_proposal(required: true, status: 'submitted');
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/approve")
        ->assertOk()
        ->assertJsonPath('data.ethical_clearance_status', 'approved');

    expect($proposal->fresh()->ethical_clearance_verified_by)->toBe($officer->id);
    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id && $job->event === 'ethical_clearance_resolved');
});

test('an officer can reject a submitted clearance with a reason', function () {
    [$pi, $proposal] = ec_proposal(required: true, status: 'submitted');
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/reject", [
            'reason' => 'The certificate has already expired.',
        ])
        ->assertOk()
        ->assertJsonPath('data.ethical_clearance_status', 'rejected');

    expect($proposal->fresh()->ethical_clearance_rejection_reason)->toBe('The certificate has already expired.');
});

test('rejecting without a reason is rejected', function () {
    [, $proposal] = ec_proposal(required: true, status: 'submitted');
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/reject", [])
        ->assertStatus(422);
});

test('cannot approve a clearance that is not currently submitted', function () {
    [, $proposal] = ec_proposal(required: true, status: 'pending');
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/approve")
        ->assertStatus(422);
});

test('a reviewer cannot approve a clearance', function () {
    [, $proposal] = ec_proposal(required: true, status: 'submitted');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ethical-clearance/approve")
        ->assertStatus(403);
});

// ─── rtt:track-ethical-clearance-expiry ─────────────────────────────────────────

test('the expiry command sends a reminder 7 days before an approved clearance expires', function () {
    Queue::fake();
    [, $proposal] = ec_proposal(required: true, status: 'approved');
    $proposal->update(['ethical_clearance_expiry' => now()->addDays(7)]);

    $this->artisan('rtt:track-ethical-clearance-expiry')->assertSuccessful();

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->event === 'ethical_clearance_expiring' && $job->data['days_remaining'] === 7);
});

test('the expiry command marks a past-due approved clearance as expired', function () {
    Queue::fake();
    [, $proposal] = ec_proposal(required: true, status: 'approved');
    $proposal->update(['ethical_clearance_expiry' => now()->subDay()]);

    $this->artisan('rtt:track-ethical-clearance-expiry')->assertSuccessful();

    expect($proposal->fresh()->ethical_clearance_status)->toBe('expired');
    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->event === 'ethical_clearance_expired');
});

test('the expiry command leaves a clearance with plenty of time left alone', function () {
    Queue::fake();
    [, $proposal] = ec_proposal(required: true, status: 'approved');
    $proposal->update(['ethical_clearance_expiry' => now()->addMonths(6)]);

    $this->artisan('rtt:track-ethical-clearance-expiry')->assertSuccessful();

    expect($proposal->fresh()->ethical_clearance_status)->toBe('approved');
    Queue::assertNotPushed(SendEmailNotificationJob::class);
});
