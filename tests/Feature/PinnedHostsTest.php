<?php

use App\Support\PinnedHosts;
use Illuminate\Support\Facades\Cache;

beforeEach(fn () => Cache::forget('pinned_hosts'));

test('sign-in hosts are looked up ahead of time and handed to curl as host:443:addresses', function () {
    PinnedHosts::refresh(fn (string $host) => match ($host) {
        'login.microsoftonline.com' => ['40.126.53.21', '20.190.181.6'],
        'graph.microsoft.com' => ['20.190.183.26'],
        default => false,
    });

    expect(PinnedHosts::curlResolve('microsoft'))->toBe([
        'login.microsoftonline.com:443:40.126.53.21,20.190.181.6',
        'graph.microsoft.com:443:20.190.183.26',
    ])->and(PinnedHosts::curlResolve('google'))->toBe([]);
});

test('a lookup that fails keeps the last good addresses, and IPv6 answers are left out', function () {
    PinnedHosts::refresh(fn () => ['40.126.53.21']);
    PinnedHosts::refresh(fn (string $host) => $host === 'graph.microsoft.com' ? ['2603:1026:3000:250::80', '20.190.183.26'] : false);

    expect(PinnedHosts::curlResolve('microsoft'))->toBe([
        'login.microsoftonline.com:443:40.126.53.21',
        'graph.microsoft.com:443:20.190.183.26',
    ]);
});

test('with nothing looked up yet, sign-in resolves the hosts itself as before', function () {
    expect(PinnedHosts::curlResolve('microsoft'))->toBe([]);
});
