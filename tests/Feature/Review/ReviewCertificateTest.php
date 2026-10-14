<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewCertificate;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->reviewer = User::factory()->create(['name' => 'Almaz Haile', 'title' => 'Dr.']);
    $this->reviewer->assignRole('staff');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'RC'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RCD'.rand(10000, 99999)]);
    $this->college = $college;
    $this->call = ProposalCall::create([
        'academic_year' => '2025/2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'rc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->blind = EvaluationType::create(['name' => 'blind_review_rc', 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $this->defence = EvaluationType::create(['name' => 'open_defence_rc', 'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true]);
});

function rc_review(object $ctx, EvaluationType $type, string $status = 'submitted', string $year = '2025/2026'): void
{
    $pi = User::factory()->create();
    $proposal = Proposal::create([
        'tracker_number' => 'RC-'.rand(100000, 999999), 'proposal_call_id' => $ctx->call->id, 'category' => 'research',
        'title' => 'Secret Proposal '.rand(), 'status' => 'under_blind_review', 'pi_user_id' => $pi->id,
        'college_id' => $ctx->college->id, 'department_id' => $ctx->dept->id, 'academic_year' => $year, 'created_by' => $pi->id,
    ]);
    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $ctx->reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $ctx->central->id, 'status' => $status, 'assigned_at' => now(), 'submitted_at' => $status === 'submitted' ? now() : null,
    ]);
}

test('a reviewer sees completed reviews per academic year, unfinished ones excluded', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);
    rc_review($this, $this->defence);
    rc_review($this, $this->blind, 'pending');
    rc_review($this, $this->blind, 'submitted', '2024/2025');

    $this->actingAs($this->reviewer, 'sanctum')
        ->getJson('/api/v1/review-certificates')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.academic_year', '2025/2026')
        ->assertJsonPath('data.0.blind_reviews', 2)
        ->assertJsonPath('data.0.defence_reviews', 1)
        ->assertJsonPath('data.0.total', 3);
});

test('downloading issues a certificate PDF with a stable verification code', function () {
    rc_review($this, $this->blind);

    $first = $this->actingAs($this->reviewer, 'sanctum')->get('/api/v1/review-certificates/download?academic_year=2025/2026');
    $first->assertOk();
    expect($first->headers->get('Content-Type'))->toContain('application/pdf');

    $code = ReviewCertificate::first()->code;
    rc_review($this, $this->defence);
    $this->actingAs($this->reviewer, 'sanctum')->get('/api/v1/review-certificates/download?academic_year=2025/2026')->assertOk();

    $certificate = ReviewCertificate::first();
    expect(ReviewCertificate::count())->toBe(1)
        ->and($certificate->code)->toBe($code)
        ->and($certificate->total())->toBe(2);
});

test('no certificate for a year without completed reviews', function () {
    $this->actingAs($this->reviewer, 'sanctum')
        ->get('/api/v1/review-certificates/download?academic_year=2025/2026', ['Accept' => 'application/json'])
        ->assertNotFound();
});

test('anyone can verify a certificate, which never names the proposals', function () {
    rc_review($this, $this->blind);
    $this->actingAs($this->reviewer, 'sanctum')->get('/api/v1/review-certificates/download?academic_year=2025/2026');
    $code = ReviewCertificate::first()->code;

    $response = $this->getJson("/api/v1/certificates/verify/{$code}")
        ->assertOk()
        ->assertJsonPath('data.reviewer', 'Dr. Almaz Haile')
        ->assertJsonPath('data.total', 1);

    expect($response->getContent())->not->toContain('Secret Proposal');

    $this->getJson('/api/v1/certificates/verify/NOPE-NOPE-NOPE')->assertNotFound();
});
