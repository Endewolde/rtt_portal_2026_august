<?php

test('rtt:open-for-validation is not scheduled — it raced rtt:expire-calls on the same rows', function () {
    // Schedule::events() only reflects console-booted state, not a plain container
    // resolve from a test/HTTP context, so this asserts against the registration
    // source directly rather than fighting that framework nuance.
    $schedule = file_get_contents(base_path('bootstrap/app.php'));

    expect($schedule)->not->toContain("command('rtt:open-for-validation')");
});
