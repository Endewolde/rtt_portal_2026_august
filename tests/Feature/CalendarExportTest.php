<?php

use App\Models\ProposalCall;
use App\Models\User;
use App\Support\ICalBuilder;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── ICalBuilder unit tests ───────────────────────────────────────────────────

test('ICalBuilder builds valid VCALENDAR string', function () {
    $cal = new ICalBuilder('Test Calendar');
    $cal->addEvent(
        'test-001',
        'Test Event',
        Carbon::parse('2026-07-01 09:00:00'),
        Carbon::parse('2026-07-01 17:00:00'),
        'A test description',
    );

    $output = $cal->build();

    expect($output)
        ->toContain('BEGIN:VCALENDAR')
        ->toContain('END:VCALENDAR')
        ->toContain('BEGIN:VEVENT')
        ->toContain('END:VEVENT')
        ->toContain('SUMMARY:Test Event')
        ->toContain('DESCRIPTION:A test description')
        ->toContain('UID:test-001@rtt-platform');
});

test('ICalBuilder escapes commas and semicolons in summary', function () {
    $cal = new ICalBuilder;
    $cal->addEvent(
        'esc-001',
        'Call: Research, Innovation',
        Carbon::now(),
        Carbon::now()->addDay(),
    );

    expect($cal->build())->toContain('SUMMARY:Call: Research\\, Innovation');
});

// ─── HTTP endpoint tests ──────────────────────────────────────────────────────

test('unauthenticated user cannot download calendar', function () {
    $this->getJson('/api/v1/calendar/export')->assertUnauthorized();
});

test('authenticated user downloads a valid ics file', function () {
    $user = User::factory()->create();
    $user->assignRole('pi');

    $res = $this->get('/api/v1/calendar/export?token='.$user->createToken('calendar')->plainTextToken);

    $res->assertStatus(200);
    expect($res->headers->get('Content-Type'))->toContain('text/calendar');

    $content = $res->streamedContent();
    expect($content)
        ->toContain('BEGIN:VCALENDAR')
        ->toContain('END:VCALENDAR');
});

test('calendar includes active proposal call deadlines', function () {
    $user = User::factory()->create();
    $user->assignRole('pi');
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Q3 Research Call', 'slug' => 'q3-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(2)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $res = $this->get('/api/v1/calendar/export?token='.$user->createToken('calendar')->plainTextToken);

    expect($res->streamedContent())->toContain('Call Deadline: Q3 Research Call');
});

test('closed proposal calls are not included', function () {
    $user = User::factory()->create();
    $user->assignRole('pi');
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    ProposalCall::create([
        'academic_year' => '2025', 'category' => 'research',
        'title' => 'Old Call', 'slug' => 'old-call-'.rand(10000, 99999),
        'start_date' => now()->subMonths(3)->toDateString(), 'end_date' => now()->subMonth()->toDateString(),
        'status' => 'closed', 'is_open' => false, 'created_by' => $admin->id,
    ]);

    $res = $this->get('/api/v1/calendar/export?token='.$user->createToken('calendar')->plainTextToken);

    expect($res->streamedContent())->not->toContain('Old Call');
});
