<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewCertificate;
use App\Models\ReviewCertificateRelease;
use App\Models\User;
use App\Services\ReviewCertificateService;
use chillerlan\QRCode\QRCode;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

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
    rc_setting('certificate_min_reviews', '2');
    rc_setting('certificate_on_time_only', 'false');
});

function rc_setting(string $key, string $value): void
{
    DB::table('app_settings')->updateOrInsert(['key' => $key], ['id' => (string) Str::uuid(), 'value' => $value, 'type' => 'string', 'group' => 'general']);
}

function rc_release(object $ctx): TestResponse
{
    return $ctx->actingAs($ctx->central, 'sanctum')->postJson('/api/v1/review-certificates/admin/release', ['academic_year' => '2025/2026']);
}

function rc_review(object $ctx, EvaluationType $type, string $status = 'submitted', string $year = '2025/2026', ?User $reviewer = null, bool $late = false): void
{
    $pi = User::factory()->create();
    $proposal = Proposal::create([
        'tracker_number' => 'RC-'.rand(100000, 999999), 'proposal_call_id' => $ctx->call->id, 'category' => 'research',
        'title' => 'Secret Proposal '.rand(), 'status' => 'under_blind_review', 'pi_user_id' => $pi->id,
        'college_id' => $ctx->college->id, 'department_id' => $ctx->dept->id, 'academic_year' => $year, 'created_by' => $pi->id,
    ]);
    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => ($reviewer ?? $ctx->reviewer)->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $ctx->central->id, 'status' => $status, 'assigned_at' => now(), 'submitted_at' => $status === 'submitted' ? now() : null,
        'due_date' => $late ? now()->subDays(3)->toDateString() : now()->addDays(3)->toDateString(),
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

test('before release a reviewer sees whether they qualify but cannot download', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->defence);

    $this->actingAs($this->reviewer, 'sanctum')->getJson('/api/v1/review-certificates')
        ->assertJsonPath('data.0.released', false)
        ->assertJsonPath('data.0.eligible', true)
        ->assertJsonPath('data.0.min_reviews', 2);

    $this->actingAs($this->reviewer, 'sanctum')
        ->get('/api/v1/review-certificates/download?academic_year=2025/2026', ['Accept' => 'application/json'])
        ->assertNotFound()
        ->assertJsonPath('message', 'Certificates for 2025/2026 have not been released yet.');
});

test('releasing issues certificates only to reviewers who meet the minimum, with counts frozen', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->defence);
    $occasional = User::factory()->create();
    rc_review($this, $this->blind, reviewer: $occasional);

    rc_release($this)->assertOk()->assertJsonPath('data.stats.issued', 1);

    expect(ReviewCertificate::where('user_id', $occasional->id)->exists())->toBeFalse()
        ->and(DB::table('notifications')->where('notifiable_id', $this->reviewer->id)->where('type', 'review_certificate_released')->exists())->toBeTrue();

    rc_review($this, $this->blind);
    $download = $this->actingAs($this->reviewer, 'sanctum')->get('/api/v1/review-certificates/download?academic_year=2025/2026');
    $download->assertOk();
    expect($download->headers->get('Content-Type'))->toContain('application/pdf')
        ->and(ReviewCertificate::where('user_id', $this->reviewer->id)->first()->total())->toBe(2);

    $this->actingAs($occasional, 'sanctum')
        ->get('/api/v1/review-certificates/download?academic_year=2025/2026', ['Accept' => 'application/json'])
        ->assertNotFound();
    rc_release($this)->assertStatus(422);
});

test('when only on-time reviews count, late ones do not qualify', function () {
    rc_setting('certificate_on_time_only', 'true');
    rc_review($this, $this->blind);
    rc_review($this, $this->defence, late: true);

    $this->actingAs($this->reviewer, 'sanctum')->getJson('/api/v1/review-certificates')
        ->assertJsonPath('data.0.late', 1)
        ->assertJsonPath('data.0.counted', 1)
        ->assertJsonPath('data.0.eligible', false);

    rc_release($this)->assertStatus(422);
});

test('only the central office can release and revoke', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);

    $this->actingAs($this->reviewer, 'sanctum')->postJson('/api/v1/review-certificates/admin/release', ['academic_year' => '2025/2026'])->assertForbidden();
    $this->actingAs($this->reviewer, 'sanctum')->getJson('/api/v1/review-certificates/admin')->assertForbidden();
    expect(ReviewCertificateRelease::count())->toBe(0);
});

test('a revoked certificate cannot be downloaded and verifies as revoked until reinstated', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);
    rc_release($this);
    $certificate = ReviewCertificate::first();

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/review-certificates/{$certificate->id}/revoke", ['reason' => 'Issued in error to this reviewer.'])->assertOk();

    $this->actingAs($this->reviewer, 'sanctum')
        ->get('/api/v1/review-certificates/download?academic_year=2025/2026', ['Accept' => 'application/json'])
        ->assertNotFound();
    $this->getJson("/api/v1/certificates/verify/{$certificate->code}")->assertOk()->assertJsonPath('data.status', 'revoked');

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/review-certificates/{$certificate->id}/reinstate")->assertOk();
    $this->getJson("/api/v1/certificates/verify/{$certificate->code}")->assertJsonPath('data.status', 'valid');
});

test('anyone can verify a released certificate, which never names the proposals', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);
    rc_release($this);
    $code = ReviewCertificate::first()->code;

    $response = $this->getJson("/api/v1/certificates/verify/{$code}")
        ->assertOk()
        ->assertJsonPath('data.reviewer', 'Dr. Almaz Haile')
        ->assertJsonPath('data.status', 'valid')
        ->assertJsonPath('data.total', 2);

    expect($response->getContent())->not->toContain('Secret Proposal');

    $this->getJson('/api/v1/certificates/verify/NOPE-NOPE-NOPE')->assertNotFound();
});

test('the QR code on the certificate opens its public verification page', function () {
    $certificate = new ReviewCertificate(['code' => 'RC26-ABCD-EFGH']);
    $service = app(ReviewCertificateService::class);
    $url = $service->verifyUrl($certificate);

    $png = base64_decode(explode(',', $service->qrCode($url), 2)[1]);

    expect($url)->toEndWith('/certificates/verify/RC26-ABCD-EFGH')
        ->and((string) (new QRCode)->readFromBlob($png))->toBe($url);
});

test('certificates are signed by the Vice President by default', function () {
    expect(ReviewCertificateService::DEFAULT_SIGNATORY_TITLE)->toBe('Vice President, Research & Technology Transfer');
});

test('closing a release withdraws every certificate until it is reopened', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);
    rc_release($this);
    $code = ReviewCertificate::first()->code;

    $this->actingAs($this->central, 'sanctum')
        ->postJson('/api/v1/review-certificates/admin/close', ['academic_year' => '2025/2026', 'reason' => 'Released before defences finished.'])
        ->assertOk()
        ->assertJsonPath('data.release.close_reason', 'Released before defences finished.');

    expect(DB::table('notifications')->where('notifiable_id', $this->reviewer->id)->where('type', 'review_certificate_withdrawn')->exists())->toBeTrue();
    $this->actingAs($this->reviewer, 'sanctum')
        ->get('/api/v1/review-certificates/download?academic_year=2025/2026', ['Accept' => 'application/json'])
        ->assertNotFound()
        ->assertJsonPath('message', 'Certificates for 2025/2026 have been withdrawn.');
    $this->actingAs($this->reviewer, 'sanctum')->getJson('/api/v1/review-certificates')->assertJsonPath('data.0.withdrawn', true);
    $this->getJson("/api/v1/certificates/verify/{$code}")->assertOk()->assertJsonPath('data.status', 'withdrawn');

    $this->actingAs($this->central, 'sanctum')->postJson('/api/v1/review-certificates/admin/reopen', ['academic_year' => '2025/2026'])->assertOk();

    $this->getJson("/api/v1/certificates/verify/{$code}")->assertJsonPath('data.status', 'valid');
    expect(ReviewCertificate::first()->code)->toBe($code);
});

test('a release can only be closed once, with a reason, by the central office', function () {
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);

    $close = fn (array $body = []) => $this->actingAs($this->central, 'sanctum')
        ->postJson('/api/v1/review-certificates/admin/close', $body + ['academic_year' => '2025/2026', 'reason' => 'Released by mistake today.']);

    $close()->assertStatus(422);
    rc_release($this);
    $close(['reason' => 'short'])->assertStatus(422);
    $this->actingAs($this->reviewer, 'sanctum')
        ->postJson('/api/v1/review-certificates/admin/close', ['academic_year' => '2025/2026', 'reason' => 'Released by mistake today.'])
        ->assertForbidden();
    $close()->assertOk();
    $close()->assertStatus(422);
    $this->actingAs($this->central, 'sanctum')->postJson('/api/v1/review-certificates/admin/reopen', ['academic_year' => '2024/2025'])->assertStatus(422);
});

test('a closed year can be released again with the current rules, keeping numbers and revoking those who no longer qualify', function () {
    $other = User::factory()->create();
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);
    rc_review($this, $this->blind);
    rc_review($this, $this->blind, reviewer: $other);
    rc_review($this, $this->blind, reviewer: $other);
    rc_release($this);
    $mine = ReviewCertificate::where('user_id', $this->reviewer->id)->first();
    $theirs = ReviewCertificate::where('user_id', $other->id)->first();

    rc_release($this)->assertStatus(422);
    $this->actingAs($this->central, 'sanctum')
        ->postJson('/api/v1/review-certificates/admin/close', ['academic_year' => '2025/2026', 'reason' => 'Minimum should have been three.']);
    rc_setting('certificate_min_reviews', '3');

    rc_release($this)->assertOk()->assertJsonPath('data.release.closed_at', null)->assertJsonPath('data.rules.min_reviews', 3);

    expect($mine->fresh()->code)->toBe($mine->code)
        ->and($mine->fresh()->isRevoked())->toBeFalse()
        ->and($theirs->fresh()->isRevoked())->toBeTrue();
    $this->getJson("/api/v1/certificates/verify/{$theirs->code}")->assertJsonPath('data.status', 'revoked');
});
