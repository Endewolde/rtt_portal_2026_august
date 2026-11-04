<?php

use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// Note: toggle-maintenance and run-backup actually shell out to `artisan up/down`
// and `backup:run` respectively, with real filesystem side effects (maintenance
// mode file, real backup archive) outside the test's DB transaction. Only their
// authorization boundary is exercised here — not the real command execution.

// ─── clear-cache ─────────────────────────────────────────────────────────────

test('a non-super_admin cannot clear the cache', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/clear-cache')
        ->assertStatus(403);
});

test('super_admin can clear the cache', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/settings/clear-cache')
        ->assertOk()
        ->assertJsonPath('message', 'Cache cleared successfully.');
});

// ─── toggle-maintenance ──────────────────────────────────────────────────────

test('a non-super_admin cannot toggle maintenance mode', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/toggle-maintenance')
        ->assertStatus(403);
});

test('enabling maintenance shows the branded page, uses an unguessable secret and keeps the admin in', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    // Artisan is faked: a real `down` would put this whole checkout into maintenance.
    $secret = null;
    Artisan::shouldReceive('call')->once()->withArgs(function (string $command, array $options) use (&$secret) {
        $secret = $options['--secret'] ?? null;

        return $command === 'down'
            && $options['--render'] === 'errors::503'
            && $options['--refresh'] === 60
            && preg_match('/^rtt-bypass-[A-Za-z0-9]{32}$/', (string) $secret) === 1;
    })->andReturn(0);

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/settings/toggle-maintenance')
        ->assertOk()
        ->assertJsonPath('data.maintenance', true)
        ->assertCookie('laravel_maintenance', null, false);

    expect($response->json('data.bypass_url'))->toBe(url($secret));
});

test('switching maintenance on emails the access link to every active super admin straight away', function () {
    $superAdmin = User::factory()->create(['name' => 'Switcher']);
    $superAdmin->assignRole('super_admin');
    $otherSuper = User::factory()->create(['email' => 'second@wsu.edu.et', 'status' => 'active']);
    $otherSuper->assignRole('super_admin');
    $inactiveSuper = User::factory()->create(['email' => 'gone@wsu.edu.et', 'status' => 'inactive']);
    $inactiveSuper->assignRole('super_admin');
    $admin = User::factory()->create(['email' => 'admin@wsu.edu.et']);
    $admin->assignRole('admin');

    Artisan::shouldReceive('call')->once()->andReturn(0);
    Bus::fake([SendRawMailJob::class]);

    $response = $this->actingAs($superAdmin, 'sanctum')->postJson('/api/v1/settings/toggle-maintenance')->assertOk();
    $url = $response->json('data.bypass_url');

    // Sent now, not queued: queue workers pause while the app is in maintenance.
    Bus::assertDispatchedSync(SendRawMailJob::class, fn ($job) => $job->to === 'second@wsu.edu.et' && str_contains($job->html, $url) && str_contains($job->html, 'Switcher'));
    Bus::assertDispatchedSync(SendRawMailJob::class, fn ($job) => $job->to === $superAdmin->email);
    Bus::assertNotDispatchedSync(SendRawMailJob::class, fn ($job) => in_array($job->to, ['gone@wsu.edu.et', 'admin@wsu.edu.et'], true));
    expect($response->json('data.emailed'))->toBe(2);
});

test('the maintenance page carries the institution\'s branding and checks back by itself', function () {
    AppSetting::updateOrCreate(['key' => 'organization_name'], ['value' => 'Wolaita Sodo University', 'type' => 'string', 'group' => 'general']);
    AppSetting::updateOrCreate(['key' => 'public_social_telegram'], ['value' => 'https://t.me/rttwsu', 'type' => 'string', 'group' => 'public']);

    $html = view('errors.503')->render();

    expect($html)->toContain('Wolaita Sodo University')
        ->toContain('Scheduled maintenance')
        ->toContain('https://t.me/rttwsu')
        ->toContain('id="countdown"')
        ->not->toContain('Service Unavailable');
});

// ─── test-email ──────────────────────────────────────────────────────────────

test('a non-super_admin cannot send a test email', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/test-email')
        ->assertStatus(403);
});

test('super_admin can send a test email', function () {
    Mail::fake();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/settings/test-email', ['to' => 'someone@example.com'])
        ->assertOk()
        ->assertJsonPath('data.recipient', 'someone@example.com');
});

// ─── run-backup ──────────────────────────────────────────────────────────────

test('a non-super_admin cannot trigger a manual backup', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/run-backup')
        ->assertStatus(403);
});

// ─── upload-asset ────────────────────────────────────────────────────────────

test('a plain staff member cannot upload a branding asset', function () {
    Storage::fake('public');
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/v1/settings/upload-asset', [
            'file' => UploadedFile::fake()->image('logo.png'),
            'key' => 'system_logo',
        ])
        ->assertStatus(403);
});

test('admin can upload a branding asset and it persists as an app setting', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/upload-asset', [
            'file' => UploadedFile::fake()->image('logo.png'),
            'key' => 'system_logo',
        ])
        ->assertOk();

    expect(AppSetting::where('key', 'system_logo')->exists())->toBeTrue();
});

test('upload-asset rejects an unrecognized key', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/upload-asset', [
            'file' => UploadedFile::fake()->image('logo.png'),
            'key' => 'not_a_real_key',
        ])
        ->assertStatus(422);
});

// ─── upload-editor-image ─────────────────────────────────────────────────────

test('a plain staff member cannot upload an editor image', function () {
    Storage::fake('public');
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/v1/settings/upload-editor-image', ['image' => UploadedFile::fake()->image('pic.png')])
        ->assertStatus(403);
});

test('admin can upload an editor image', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/upload-editor-image', ['image' => UploadedFile::fake()->image('pic.png')])
        ->assertOk();
});
