<?php

use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\College;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();

    $this->admin = User::factory()->create(['status' => 'active']);
    $this->admin->assignRole('super_admin');

    $this->health = College::create(['name' => 'Health', 'code' => 'H'.rand(10000, 99999)]);
    $this->agri = College::create(['name' => 'Agriculture', 'code' => 'A'.rand(10000, 99999)]);

    $make = function (string $role, College $college, string $status = 'active') {
        $u = User::factory()->create(['college_id' => $college->id, 'status' => $status]);
        $u->assignRole($role);

        return $u;
    };
    $this->officerHealth = $make('college_officer', $this->health);
    $this->officerAgri = $make('college_officer', $this->agri);
    $this->staffHealth = $make('staff', $this->health);
    $this->inactive = $make('staff', $this->health, 'inactive');
});

test('the preview counts who an audience reaches before anything is sent', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/v1/settings/broadcast/preview', ['to' => 'by_role', 'roles' => ['college_officer'], 'college_ids' => [$this->health->id]])
        ->assertOk()
        ->assertJsonPath('data.count', 1)
        ->assertJsonPath('data.sample.0.email', $this->officerHealth->email);

    // Inactive users are never included.
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/v1/settings/broadcast/preview', ['to' => 'by_college', 'college_ids' => [$this->health->id]])
        ->assertJsonPath('data.count', 2);

    Queue::assertNothingPushed();
});

test('a broadcast goes out in the background, optionally in-app too, and is recorded', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/v1/settings/send-email', [
            'to' => 'by_role', 'roles' => ['college_officer', 'staff'], 'subject' => 'Call opens', 'message' => '<p>Hello</p>', 'in_app' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.queued', 3);

    Queue::assertPushed(SendRawMailJob::class, 3);
    Queue::assertPushed(StoreInAppNotificationJob::class, 3);

    $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/settings/broadcasts')
        ->assertOk()
        ->assertJsonPath('data.0.subject', 'Call opens')
        ->assertJsonPath('data.0.recipients', 3);
});

test('a test send goes only to the sender', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/v1/settings/send-email', ['to' => 'all', 'subject' => 'Draft', 'message' => '<p>Hi</p>', 'test' => true])
        ->assertOk()
        ->assertJsonPath('data.test', true);

    Queue::assertPushed(SendRawMailJob::class, 1);
    Queue::assertPushed(SendRawMailJob::class, fn ($job) => $job->to === $this->admin->email);
});

test('chosen people and ready-made groups work, and only settings managers may broadcast', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/v1/settings/broadcast/preview', ['to' => 'specific', 'user_ids' => [$this->officerAgri->id, $this->staffHealth->id]])
        ->assertJsonPath('data.count', 2);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/v1/settings/broadcast/preview', ['to' => 'segment', 'segment' => 'officers'])
        ->assertJsonPath('data.count', 3); // two college officers and the admin

    $this->actingAs($this->staffHealth, 'sanctum')
        ->postJson('/api/v1/settings/send-email', ['to' => 'all', 'subject' => 'x', 'message' => 'y'])
        ->assertForbidden();
});
