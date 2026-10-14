<?php

use Illuminate\Support\Facades\Artisan;

test('rtt:open-for-validation is not scheduled — it raced rtt:expire-calls on the same rows', function () {
    // Schedule::events() only reflects console-booted state, not a plain container
    // resolve from a test/HTTP context, so this asserts against the registration
    // source directly rather than fighting that framework nuance.
    $schedule = file_get_contents(base_path('bootstrap/app.php'));

    expect($schedule)->not->toContain("command('rtt:open-for-validation')");
});

test('no scheduled job is registered twice', function () {
    Artisan::call('schedule:list');

    preg_match_all('/php artisan ([\w:-]+(?: \w+)?)/', Artisan::output(), $matches);
    $counts = array_count_values($matches[1]);
    unset($counts['backup:run']); // deliberately runs three times a day

    expect(array_filter($counts, fn ($n) => $n > 1))->toBe([]);
});
