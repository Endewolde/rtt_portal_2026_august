<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReportSubscription;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\IOFactory;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    config(['mail.default' => 'array']);
    $this->central = User::factory()->create(['email' => 'director@example.test']);
    $this->central->assignRole('central_officer');
    $this->college = College::create(['name' => 'Sub College', 'code' => 'SB'.rand(10000, 99999)]);
    $this->other = College::create(['name' => 'Other College', 'code' => 'SO'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'sb-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    foreach ([$this->college, $this->college, $this->other] as $college) {
        $dept = Department::firstOrCreate(['college_id' => $college->id, 'name' => 'D'], ['code' => 'SD'.rand(10000, 99999)]);
        $pi = User::factory()->create();
        Proposal::create([
            'tracker_number' => 'SB-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
            'title' => 'Sub '.rand(), 'status' => 'submitted', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => '2026-2027', 'created_by' => $pi->id,
        ]);
    }
});

function sentMessages(): array
{
    return app('mailer')->getSymfonyTransport()->messages()->all();
}

test('a person schedules a report and sees when it goes next', function () {
    $response = $this->actingAs($this->central, 'sanctum')->postJson('/api/v1/report-subscriptions', [
        'report_type' => 'proposal_count_by_college', 'frequency' => 'weekly', 'weekday' => 1, 'format' => 'pdf',
        'filters' => ['academic_year' => '2026-2027'],
    ])->assertCreated();

    expect($response->json('data.schedule'))->toBe('Every Monday as PDF')
        ->and($response->json('data.next_run'))->not->toBeNull();
    $this->getJson('/api/v1/report-subscriptions')->assertJsonCount(1, 'data');
});

test('a college officer can only ever schedule their own college', function () {
    $officer = User::factory()->create(['college_id' => $this->college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')->postJson('/api/v1/report-subscriptions', [
        'report_type' => 'proposal_count_by_college', 'frequency' => 'monthly', 'day_of_month' => 1, 'format' => 'xlsx',
        'filters' => ['college_id' => $this->other->id],
    ])->assertCreated();

    expect(ReportSubscription::first()->filters['college_id'])->toBe($this->college->id);
});

test('weekly and monthly schedules fall due on the right days, once', function () {
    $weekly = new ReportSubscription(['frequency' => 'weekly', 'weekday' => 3, 'active' => true]);
    $monthly = new ReportSubscription(['frequency' => 'monthly', 'day_of_month' => 31, 'active' => true]);

    expect($weekly->isDueOn(Carbon::parse('2026-10-21')))->toBeTrue()   // a Wednesday
        ->and($weekly->isDueOn(Carbon::parse('2026-10-22')))->toBeFalse()
        ->and($monthly->isDueOn(Carbon::parse('2027-02-28')))->toBeTrue() // last day of a short month
        ->and($monthly->isDueOn(Carbon::parse('2027-03-30')))->toBeFalse();

    $weekly->last_sent_at = Carbon::parse('2026-10-21 06:30');
    expect($weekly->isDueOn(Carbon::parse('2026-10-21')))->toBeFalse();
});

test('due reports are emailed with the file attached, limited to the subscriber’s scope', function () {
    $officer = User::factory()->create(['college_id' => $this->college->id, 'email' => 'officer@example.test']);
    $officer->assignRole('college_officer');
    $subscription = ReportSubscription::create([
        'user_id' => $officer->id, 'report_type' => 'proposal_count_by_college', 'frequency' => 'weekly',
        'weekday' => now()->dayOfWeekIso, 'format' => 'xlsx', 'filters' => [], 'active' => true,
    ]);
    ReportSubscription::create([
        'user_id' => $this->central->id, 'report_type' => 'proposal_count_by_category', 'frequency' => 'weekly',
        'weekday' => now()->dayOfWeekIso, 'format' => 'pdf', 'active' => false,
    ]);

    $this->artisan('rtt:report-subscriptions')->expectsOutputToContain('1 scheduled report(s) sent.')->assertSuccessful();

    $messages = sentMessages();
    expect($messages)->toHaveCount(1);
    $email = $messages[0]->getOriginalMessage();
    $attachment = $email->getAttachments()[0];
    expect($email->getTo()[0]->getAddress())->toBe('officer@example.test')
        ->and($attachment->getFilename())->toEndWith('.xlsx');

    $path = tempnam(sys_get_temp_dir(), 'rs').'.xlsx';
    file_put_contents($path, $attachment->getBody());
    $cells = collect(IOFactory::load($path)->getActiveSheet()->toArray())->flatten()->filter()->implode(' ');
    expect($cells)->toContain('Sub College')->not->toContain('Other College')
        ->and($subscription->fresh()->last_sent_at)->not->toBeNull();

    $this->artisan('rtt:report-subscriptions')->expectsOutputToContain('0 scheduled report(s) sent.');
});

test('send now delivers a PDF straight away, and only the owner can manage it', function () {
    $subscription = ReportSubscription::create([
        'user_id' => $this->central->id, 'report_type' => 'review_progress_pipeline', 'frequency' => 'monthly',
        'day_of_month' => 1, 'format' => 'pdf', 'active' => true,
    ]);

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/report-subscriptions/{$subscription->id}/send")->assertOk();
    expect(sentMessages()[0]->getOriginalMessage()->getAttachments()[0]->getFilename())->toEndWith('.pdf');

    $someoneElse = User::factory()->create();
    $someoneElse->assignRole('central_officer');
    $this->actingAs($someoneElse, 'sanctum')->deleteJson("/api/v1/report-subscriptions/{$subscription->id}")->assertNotFound();
    $this->actingAs($this->central, 'sanctum')->putJson("/api/v1/report-subscriptions/{$subscription->id}", ['active' => false])
        ->assertOk()->assertJsonPath('data.active', false);
});
