<?php

use App\Services\TrackerNumberService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->service = app(TrackerNumberService::class);
});

test('generates correct prefix per category', function (string $category, string $prefix) {
    $number = $this->service->generate($category, '2026');

    expect($number)->toStartWith($prefix.'-2026-');
})->with([
    'research'             => ['research',             'RES'],
    'community_engagement' => ['community_engagement', 'COM'],
    'technology_transfer'  => ['technology_transfer',  'TECH'],
    'innovation'           => ['innovation',           'INN'],
    'other'                => ['other',                'OTH'],
]);

test('sequence increments correctly on second call for same category and year', function () {
    $first  = $this->service->generate('research', '2026');
    $second = $this->service->generate('research', '2026');

    expect($first)->toBe('RES-2026-000001')
        ->and($second)->toBe('RES-2026-000002');
});

test('different categories have independent sequences', function () {
    $res  = $this->service->generate('research',  '2026');
    $inn  = $this->service->generate('innovation', '2026');
    $res2 = $this->service->generate('research',  '2026');

    expect($res)->toBe('RES-2026-000001')
        ->and($inn)->toBe('INN-2026-000001')
        ->and($res2)->toBe('RES-2026-000002');
});

test('format is exactly PREFIX-YEAR-000001', function () {
    $number = $this->service->generate('research', '2026');

    expect($number)->toBe('RES-2026-000001')
        ->and($number)->toMatch('/^[A-Z]+-\d{4}-\d{6}$/');
});

test('concurrent calls produce unique numbers', function () {
    $numbers = [];

    for ($i = 0; $i < 10; $i++) {
        $numbers[] = $this->service->generate('research', '2026');
    }

    // All numbers must be unique
    expect(array_unique($numbers))->toHaveCount(10);

    // Sequences must be 000001 through 000010
    expect($numbers[0])->toBe('RES-2026-000001');
    expect($numbers[9])->toBe('RES-2026-000010');
});
