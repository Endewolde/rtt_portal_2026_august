<?php

use App\Models\AppSetting;
use App\Models\User;
use App\Support\TokenLifetime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\PersonalAccessToken;

uses(RefreshDatabase::class);

beforeEach(function () {
    AppSetting::updateOrCreate(['key' => 'session_timeout_minutes'], ['value' => '20', 'type' => 'number', 'group' => 'security']);
    Cache::forget('token_idle_minutes');
    $this->user = User::factory()->create(['status' => 'active']);
    $this->call = fn (string $token) => $this->withToken($token)->getJson('/api/v1/auth/ping');
});

function tl_token(User $user, ?string $lastUsed, string $created = 'now'): string
{
    $new = $user->createToken('auth_token');
    PersonalAccessToken::whereKey($new->accessToken->id)->update([
        'last_used_at' => $lastUsed ? now()->modify($lastUsed) : null,
        'created_at' => now()->modify($created),
    ]);

    return $new->plainTextToken;
}

test('a sign-in in use keeps working, and each request keeps it alive', function () {
    $token = tl_token($this->user, '-10 minutes');

    ($this->call)($token)->assertNoContent();
    expect(PersonalAccessToken::first()->last_used_at->gt(now()->subMinute()))->toBeTrue();
});

test('a sign-in left unused longer than the session timeout and its margin stops working on the server', function () {
    $stale = tl_token($this->user, '-51 minutes'); // 20 min timeout + 30 min margin
    ($this->call)($stale)->assertUnauthorized();

    app('auth')->forgetGuards();
    $fresh = tl_token($this->user, '-49 minutes');
    ($this->call)($fresh)->assertNoContent();
});

test('no sign-in outlives thirty days, however often it is used', function () {
    ($this->call)(tl_token($this->user, '-1 minute', '-31 days'))->assertUnauthorized();
});

test('without a session timeout an unused sign-in still lapses after two weeks', function () {
    AppSetting::where('key', 'session_timeout_minutes')->update(['value' => '0']);
    Cache::forget('token_idle_minutes');

    ($this->call)(tl_token($this->user, '-13 days'))->assertNoContent();
    app('auth')->forgetGuards();
    ($this->call)(tl_token($this->user, '-15 days'))->assertUnauthorized();
});

test('expired sign-ins are pruned and live ones kept', function () {
    tl_token($this->user, '-2 hours');
    tl_token($this->user, null, '-2 hours');
    tl_token($this->user, '-1 minute');

    expect(TokenLifetime::prune())->toBe(2)->and(PersonalAccessToken::count())->toBe(1);
});
