<?php

use App\Jobs\SendRawMailJob;
use App\Models\SupportApplication;
use App\Models\SupportScheme;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    Storage::fake('local');
    (new RolePermissionSeeder)->run();
    $this->office = User::factory()->create(['status' => 'active']);
    $this->office->assignRole('research_officer');
    $this->staff = User::factory()->create(['status' => 'active', 'email' => 'author@example.com']);
    $this->staff->assignRole('staff');
    $this->scheme = SupportScheme::create(['name' => 'Scopus incentive', 'kind' => 'publication_incentive', 'budget' => 30000, 'max_award' => 20000, 'max_per_person' => 1, 'active' => true]);
    $this->apply = fn (array $over = []) => $this->actingAs($this->staff, 'sanctum')->post('/api/v1/support-grants', [
        'scheme_id' => $this->scheme->id, 'title' => 'Soil carbon in enset systems', 'amount_requested' => 15000,
        'evidence' => UploadedFile::fake()->create('paper.pdf', 100, 'application/pdf'), ...$over,
    ], ['Accept' => 'application/json']);
});

test('staff apply with evidence within the scheme\'s limits', function () {
    ($this->apply)(['amount_requested' => 25000])->assertUnprocessable()->assertJsonPath('errors.amount_requested.0', 'At most 20,000.');
    ($this->apply)()->assertCreated()->assertJsonPath('data.reference', 'SG-'.now()->format('Y').'-0001');
    ($this->apply)()->assertUnprocessable(); // one per person

    $this->scheme->update(['closes_on' => now()->subDay()]);
    $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/support-grants/mine')->assertOk()->assertJsonCount(0, 'data.schemes');
});

test('the office approves within the budget, the applicant is emailed, then it is paid', function () {
    $id = ($this->apply)()->json('data.id');
    $other = User::factory()->create(['status' => 'active']);
    $second = SupportApplication::create(['scheme_id' => $this->scheme->id, 'applicant_id' => $other->id, 'title' => 'B', 'amount_requested' => 20000]);

    $this->actingAs($this->office, 'sanctum')->postJson("/api/v1/admin/support-grants/{$id}/decide", ['action' => 'approve', 'amount_approved' => 15000])->assertOk();
    Queue::assertPushed(SendRawMailJob::class, fn ($j) => $j->to === 'author@example.com' && str_starts_with($j->subject, 'Approved'));

    // 15,000 of 30,000 committed: 20,000 more would go over.
    $this->actingAs($this->office, 'sanctum')->postJson("/api/v1/admin/support-grants/{$second->id}/decide", ['action' => 'approve', 'amount_approved' => 20000])
        ->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'budget'));

    $this->actingAs($this->office, 'sanctum')->postJson("/api/v1/admin/support-grants/{$id}/decide", ['action' => 'pay'])->assertOk();
    expect(SupportApplication::find($id))->status->toBe('paid')->paid_on->not->toBeNull();
});

test('a refusal needs a reason, and only the applicant and the office see the evidence', function () {
    $id = ($this->apply)()->json('data.id');

    $this->actingAs($this->office, 'sanctum')->postJson("/api/v1/admin/support-grants/{$id}/decide", ['action' => 'reject'])->assertJsonValidationErrors('decision_note');
    $this->actingAs($this->office, 'sanctum')->get("/api/v1/support-grants/{$id}/evidence")->assertOk();
    $this->actingAs($this->staff, 'sanctum')->get("/api/v1/support-grants/{$id}/evidence")->assertOk();

    $stranger = User::factory()->create(['status' => 'active']);
    $stranger->assignRole('staff');
    $this->actingAs($stranger, 'sanctum')->get("/api/v1/support-grants/{$id}/evidence")->assertForbidden();
    $this->actingAs($stranger, 'sanctum')->getJson('/api/v1/admin/support-grants')->assertForbidden();
});
