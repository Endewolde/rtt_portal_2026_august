<?php

use App\Jobs\SendRawMailJob;
use App\Models\Innovation;
use App\Models\Partnership;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();
    $this->office = User::factory()->create(['status' => 'active', 'email' => 'tto@example.com']);
    $this->office->assignRole('technology_officer');
    $this->staff = User::factory()->create(['status' => 'active']);
    $this->staff->assignRole('staff');
});

test('the technology transfer office keeps the agreements register; staff cannot see it', function () {
    Storage::fake('local');
    $res = $this->actingAs($this->office, 'sanctum')->post('/api/v1/tech-transfer/partnerships', [
        'partner_name' => 'Ethiopian Agricultural Research Institute', 'partner_type' => 'government', 'agreement_type' => 'mou',
        'signed_on' => '2025-01-10', 'expires_on' => now()->addDays(40)->toDateString(), 'terminated' => '0',
        'document' => UploadedFile::fake()->create('mou.pdf', 120, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated();

    expect($res->json('data.state'))->toBe('expiring')->and($res->json('data'))->not->toHaveKey('document_path');
    $id = $res->json('data.id');
    $this->actingAs($this->office, 'sanctum')->get("/api/v1/tech-transfer/partnerships/{$id}/document")->assertOk();

    $list = $this->actingAs($this->office, 'sanctum')->getJson('/api/v1/tech-transfer/partnerships?state=expiring')->assertOk();
    expect($list->json('data'))->toHaveCount(1)->and($list->json('meta.counts.expiring'))->toBe(1);

    $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/tech-transfer/partnerships')->assertForbidden();
    $this->actingAs($this->staff, 'sanctum')->get("/api/v1/tech-transfer/partnerships/{$id}/document")->assertForbidden();
});

test('an agreement cannot end before it was signed', function () {
    $this->actingAs($this->office, 'sanctum')->postJson('/api/v1/tech-transfer/partnerships', [
        'partner_name' => 'X', 'partner_type' => 'industry', 'agreement_type' => 'contract', 'signed_on' => '2026-05-01', 'expires_on' => '2026-01-01',
    ])->assertJsonValidationErrors('expires_on');
});

test('agreements ending within 90 days are reminded once a month, and renewing one restarts the reminders', function () {
    $focal = User::factory()->create(['status' => 'active', 'email' => 'focal@example.com']);
    $soon = Partnership::create(['partner_name' => 'Hawassa University', 'partner_type' => 'university', 'agreement_type' => 'mou', 'expires_on' => now()->addDays(30), 'focal_person_id' => $focal->id]);
    Partnership::create(['partner_name' => 'Far Off', 'partner_type' => 'ngo', 'agreement_type' => 'mou', 'expires_on' => now()->addYear()]);

    Artisan::call('rtt:partnership-reminders');
    Queue::assertPushed(SendRawMailJob::class, 2);
    Queue::assertPushed(SendRawMailJob::class, fn ($j) => $j->to === 'focal@example.com' && str_contains($j->subject, 'Hawassa University'));

    Artisan::call('rtt:partnership-reminders');
    Queue::assertPushed(SendRawMailJob::class, 2); // not again within the month

    $this->actingAs($this->office, 'sanctum')->post("/api/v1/tech-transfer/partnerships/{$soon->id}", [
        'partner_name' => 'Hawassa University', 'partner_type' => 'university', 'agreement_type' => 'mou', 'expires_on' => now()->addYears(5)->toDateString(),
    ], ['Accept' => 'application/json'])->assertOk();
    expect($soon->fresh()->reminded_on)->toBeNull()->and($soon->fresh()->state)->toBe('active');
});

test('an innovation moves through the pipeline, each stage asking for what it needs, and income is totalled', function () {
    $res = $this->actingAs($this->office, 'sanctum')->postJson('/api/v1/tech-transfer/innovations', [
        'title' => 'Solar enset processor', 'ip_type' => 'patent', 'stage' => 'disclosed', 'inventors' => ['Abebe K.', 'Sara T.'],
    ])->assertCreated();
    $id = $res->json('data.id');
    expect($res->json('data.reference'))->toBe('INV-'.now()->format('Y').'-001');

    $this->actingAs($this->office, 'sanctum')->putJson("/api/v1/tech-transfer/innovations/{$id}", ['title' => 'Solar enset processor', 'ip_type' => 'patent', 'stage' => 'granted'])
        ->assertJsonValidationErrors(['filing_number', 'granted_on']);
    $this->actingAs($this->office, 'sanctum')->putJson("/api/v1/tech-transfer/innovations/{$id}", [
        'title' => 'Solar enset processor', 'ip_type' => 'patent', 'stage' => 'commercialised', 'filing_number' => 'ET/P/2026/1', 'filed_on' => '2026-01-01',
        'granted_on' => '2026-06-01', 'commercialisation' => 'spin_off',
    ])->assertJsonValidationErrors('spin_off_name');

    $this->actingAs($this->office, 'sanctum')->postJson("/api/v1/tech-transfer/innovations/{$id}/incomes", ['amount' => 150000, 'currency' => 'etb', 'received_on' => now()->toDateString(), 'source' => 'licence_fee'])->assertCreated();
    $this->actingAs($this->office, 'sanctum')->postJson("/api/v1/tech-transfer/innovations/{$id}/incomes", ['amount' => 1000, 'currency' => 'USD', 'received_on' => now()->toDateString(), 'source' => 'royalty'])->assertCreated();

    $list = $this->actingAs($this->office, 'sanctum')->getJson('/api/v1/tech-transfer/innovations')->assertOk();
    expect($list->json('meta.income_total'))->toEqual(150000)
        ->and($list->json('meta.by_stage.disclosed'))->toBe(1)
        ->and(Innovation::find($id)->incomes()->count())->toBe(2);

    // Staff can neither see nor change the pipeline.
    $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/tech-transfer/innovations')->assertForbidden();
});
