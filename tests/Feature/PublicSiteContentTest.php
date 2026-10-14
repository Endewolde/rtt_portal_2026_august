<?php

use App\Models\Faq;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function psc_migration(string $name): object
{
    return require collect(glob(database_path("migrations/*_{$name}.php")))->first();
}

test('the FAQ update replaces untouched answers, keeps edited ones, and adds the new questions', function () {
    Faq::create(['question' => 'How long does the review process take?', 'is_active' => true, 'sort_order' => 4,
        'answer' => "Timelines vary by call. Typically: validation takes 1–2 weeks, blind peer review takes 3–6 weeks, open defence is scheduled after reviews complete, and central evaluation takes 1–2 weeks. Check the specific call's guidelines for expected timelines."]);
    Faq::create(['question' => 'What happens after my proposal is accepted?', 'answer' => 'Our own wording.', 'is_active' => true, 'sort_order' => 5]);

    psc_migration('update_public_faqs_for_current_process')->up();

    expect(Faq::where('question', 'How long does the review process take?')->value('answer'))->toStartWith('Each stage has a target time')
        ->and(Faq::where('question', 'What happens after my proposal is accepted?')->value('answer'))->toBe('Our own wording.')
        ->and(Faq::where('question', 'What is the open defence?')->exists())->toBeTrue()
        ->and(Faq::count())->toBe(5);
});

test('saved How It Works text that is still an old default is cleared; custom text stays', function () {
    foreach (['public_step_3_title' => 'Peer Review & Defence', 'public_step_4_title' => 'Grants & Mentoring'] as $key => $value) {
        DB::table('app_settings')->insert(['id' => (string) Str::uuid(), 'key' => $key, 'value' => $value, 'type' => 'string', 'group' => 'public_site']);
    }

    psc_migration('reset_default_public_steps_for_six_stage_process')->up();

    expect(DB::table('app_settings')->where('key', 'public_step_3_title')->value('value'))->toBe('')
        ->and(DB::table('app_settings')->where('key', 'public_step_4_title')->value('value'))->toBe('Grants & Mentoring');
});

test('the public certificate lookup page is reachable without a number', function () {
    $this->get('/certificates/verify')->assertOk();
});
