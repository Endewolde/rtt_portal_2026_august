<?php

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\College;
use App\Models\NotificationPreference;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function validRegistrationData(array $overrides = []): array
{
    $college = College::factory()->create();

    return array_merge([
        'name' => 'Jane Doe',
        'title' => 'Dr.',
        'email' => 'jane@example.com',
        'gender' => 'female',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'college_id' => $college->id,
        'expertise' => ['Machine Learning', 'Biomedical Engineering'],
    ], $overrides);
}

test('user can register with valid data', function () {
    $response = $this->postJson('/api/v1/auth/register', validRegistrationData());

    $response->assertCreated()
        ->assertJsonPath('message', 'Registration successful. Please check your email to verify your account.')
        ->assertJsonStructure(['data' => ['user']]);

    $this->assertDatabaseHas('users', ['email' => 'jane@example.com']);
});

test('registered user is assigned guest role automatically', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationData())->assertCreated();

    $user = User::where('email', 'jane@example.com')->first();
    expect($user->hasRole('guest'))->toBeTrue();
});

test('registered user has notification_preferences row created', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationData())->assertCreated();

    $user = User::where('email', 'jane@example.com')->first();

    expect(NotificationPreference::where('user_id', $user->id)->exists())->toBeTrue();
});

test('registration is logged in audit_logs', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationData())->assertCreated();

    $user = User::where('email', 'jane@example.com')->first();

    expect(
        AuditLog::where('auditable_id', $user->id)
            ->where('event', 'user.registered')
            ->exists()
    )->toBeTrue();
});

test('cannot register with duplicate email', function () {
    User::factory()->create(['email' => 'existing@example.com']);

    $this->postJson('/api/v1/auth/register', validRegistrationData(['email' => 'existing@example.com']))
        ->assertUnprocessable();
});

test('registration is blocked when self_registration setting is disabled', function () {
    AppSetting::create(['key' => 'self_registration', 'value' => 'false', 'type' => 'boolean', 'group' => 'users']);

    $this->postJson('/api/v1/auth/register', validRegistrationData())->assertForbidden();

    $this->assertDatabaseMissing('users', ['email' => 'jane@example.com']);
});

test('registration is allowed when self_registration setting is enabled', function () {
    AppSetting::create(['key' => 'self_registration', 'value' => 'true', 'type' => 'boolean', 'group' => 'users']);

    $this->postJson('/api/v1/auth/register', validRegistrationData())->assertCreated();
});

test('cannot register with password shorter than 8 characters', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationData([
        'password' => 'short',
        'password_confirmation' => 'short',
    ]))->assertUnprocessable()
        ->assertJsonPath('errors.password.0', fn ($msg) => str_contains($msg, '8'));
});

test('title and gender are required for registration', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationData([
        'title' => '',
        'gender' => '',
    ]))->assertUnprocessable()
        ->assertJsonValidationErrors(['title', 'gender']);
});

test('college_id is required for registration', function () {
    $data = validRegistrationData();
    unset($data['college_id']);

    $this->postJson('/api/v1/auth/register', $data)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['college_id']);
});

test('expertise is required for registration', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationData(['expertise' => []]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['expertise']);
});

test('registration is blocked when email does not match allowed domain', function () {
    AppSetting::create(['key' => 'registration_email_domain', 'value' => 'wsu.edu.et', 'type' => 'string', 'group' => 'users', 'description' => 'test']);

    $this->postJson('/api/v1/auth/register', validRegistrationData(['email' => 'jane@gmail.com']))
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', fn ($msg) => str_contains($msg, 'wsu.edu.et'));
});

test('registration succeeds when email matches allowed domain', function () {
    AppSetting::create(['key' => 'registration_email_domain', 'value' => 'wsu.edu.et', 'type' => 'string', 'group' => 'users', 'description' => 'test']);

    $this->postJson('/api/v1/auth/register', validRegistrationData(['email' => 'jane@wsu.edu.et']))
        ->assertCreated();
});

test('registration with wrong domain is blocked regardless of form request', function () {
    AppSetting::create(['key' => 'registration_email_domain', 'value' => 'wsu.edu.et', 'type' => 'string', 'group' => 'users', 'description' => 'test']);

    foreach (['jane@ethernet.edu.et', 'jane@gmail.com', 'jane@yahoo.com', 'jane@wsu.edu.et.fake.com'] as $bad) {
        $this->postJson('/api/v1/auth/register', validRegistrationData(['email' => $bad]))
            ->assertUnprocessable("Expected 422 for email: {$bad}");
    }
});
