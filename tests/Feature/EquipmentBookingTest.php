<?php

use App\Jobs\SendRawMailJob;
use App\Models\Equipment;
use App\Models\EquipmentBooking;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();
    $this->custodian = User::factory()->create(['status' => 'active', 'email' => 'lab@example.com']);
    $this->custodian->assignRole('staff');
    $this->researcher = User::factory()->create(['status' => 'active', 'email' => 'res@example.com']);
    $this->researcher->assignRole('staff');
    $this->aas = Equipment::create(['name' => 'Atomic absorption spectrophotometer', 'custodian_id' => $this->custodian->id, 'requires_approval' => true, 'max_booking_hours' => 8]);
    $this->book = fn (User $u, string $from, string $to) => $this->actingAs($u, 'sanctum')->postJson("/api/v1/equipment/{$this->aas->id}/bookings", [
        'starts_at' => now()->addDays(2)->setTimeFromTimeString($from)->toDateTimeString(),
        'ends_at' => now()->addDays(2)->setTimeFromTimeString($to)->toDateTimeString(),
        'purpose' => 'Soil nutrient analysis',
    ]);
});

test('a booking is requested, the custodian is asked, and approving it tells the researcher', function () {
    $id = ($this->book)($this->researcher, '09:00', '12:00')->assertCreated()->assertJsonPath('data.status', 'pending')->json('data.id');
    Queue::assertPushed(SendRawMailJob::class, fn ($j) => $j->to === 'lab@example.com' && str_contains($j->subject, 'Booking request'));

    $this->actingAs($this->custodian, 'sanctum')->getJson('/api/v1/equipment')->assertOk()->assertJsonCount(1, 'data.to_approve');
    $this->actingAs($this->custodian, 'sanctum')->postJson("/api/v1/equipment-bookings/{$id}/decide", ['action' => 'approve'])->assertOk();
    Queue::assertPushed(SendRawMailJob::class, fn ($j) => $j->to === 'res@example.com' && str_contains($j->subject, 'confirmed'));

    // Someone who is neither custodian nor manager cannot decide.
    $other = User::factory()->create(['status' => 'active']);
    $second = ($this->book)($other, '13:00', '14:00')->json('data.id');
    $this->actingAs($this->researcher, 'sanctum')->postJson("/api/v1/equipment-bookings/{$second}/decide", ['action' => 'approve'])->assertForbidden();
});

test('two bookings of the same equipment never overlap, and long or out-of-service bookings are refused', function () {
    ($this->book)($this->researcher, '09:00', '12:00')->assertCreated();
    ($this->book)($this->custodian, '11:00', '13:00')->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'already booked'));
    ($this->book)($this->custodian, '12:00', '13:00')->assertCreated(); // touching, not overlapping

    ($this->book)($this->custodian, '06:00', '16:00')->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'at most 8 hours'));
    $this->aas->update(['status' => 'maintenance']);
    ($this->book)($this->custodian, '15:00', '16:00')->assertUnprocessable();
});

test('declining needs a reason, and the researcher can cancel their own booking', function () {
    $id = ($this->book)($this->researcher, '09:00', '10:00')->json('data.id');
    $this->actingAs($this->custodian, 'sanctum')->postJson("/api/v1/equipment-bookings/{$id}/decide", ['action' => 'reject'])->assertJsonValidationErrors('decision_note');

    $this->actingAs($this->researcher, 'sanctum')->postJson("/api/v1/equipment-bookings/{$id}/cancel")->assertOk();
    expect(EquipmentBooking::find($id)->status)->toBe('cancelled');
    // The freed slot can be booked again.
    ($this->book)($this->custodian, '09:00', '10:00')->assertCreated();
});

test('only equipment managers add equipment to the register', function () {
    $this->actingAs($this->researcher, 'sanctum')->postJson('/api/v1/equipment', ['name' => 'Centrifuge', 'status' => 'available'])->assertForbidden();
    $officer = User::factory()->create(['status' => 'active']);
    $officer->assignRole('research_officer');
    $this->actingAs($officer, 'sanctum')->postJson('/api/v1/equipment', ['name' => 'Centrifuge', 'status' => 'available', 'requires_approval' => false])->assertCreated();
});
