<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    RateLimiter::clear('login');
});

test('6th login attempt within 1 minute returns 429', function () {
    $payload = ['email' => 'test@example.com', 'password' => 'wrong'];

    // 5 allowed attempts
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', $payload);
    }

    // 6th attempt should be throttled
    $response = $this->postJson('/api/v1/auth/login', $payload);

    $response->assertStatus(429);
});

test('rate limit response has correct JSON structure with retry_after', function () {
    $payload = ['email' => 'test@example.com', 'password' => 'wrong'];

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', $payload);
    }

    $response = $this->postJson('/api/v1/auth/login', $payload);

    $response->assertStatus(429)
        ->assertJsonStructure(['data', 'message', 'errors' => ['retry_after'], 'meta'])
        ->assertJsonPath('message', 'Too many requests. Please try again later.');
});

test('4th register attempt within 1 hour returns 429', function () {
    $base = ['name' => 'Test', 'email' => 'x@x.com', 'password' => 'Password1!', 'password_confirmation' => 'Password1!'];

    for ($i = 0; $i < 3; $i++) {
        $this->postJson('/api/v1/auth/register', array_merge($base, ['email' => "user{$i}@test.com"]));
    }

    $response = $this->postJson('/api/v1/auth/register', array_merge($base, ['email' => 'user999@test.com']));

    $response->assertStatus(429);
});

test('X-RateLimit-Limit header present on API response', function () {
    $response = $this->postJson('/api/v1/auth/login', [
        'email'    => 'test@example.com',
        'password' => 'wrong',
    ]);

    $response->assertHeader('X-RateLimit-Limit');
});

test('X-RateLimit-Remaining decrements on each request', function () {
    $first  = $this->postJson('/api/v1/auth/login', ['email' => 'a@a.com', 'password' => 'wrong']);
    $second = $this->postJson('/api/v1/auth/login', ['email' => 'a@a.com', 'password' => 'wrong']);

    $remaining1 = (int) $first->headers->get('X-RateLimit-Remaining');
    $remaining2 = (int) $second->headers->get('X-RateLimit-Remaining');

    expect($remaining2)->toBeLessThan($remaining1);
});
