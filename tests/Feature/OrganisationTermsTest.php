<?php

use App\Models\AppSetting;
use App\Models\User;
use App\Support\ReportTable;
use App\Support\Terms;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
});

test('without settings the platform keeps its usual words and currency', function () {
    expect(Terms::college())->toBe('College')
        ->and(Terms::college(true))->toBe('Colleges')
        ->and(Terms::academicYear())->toBe('Academic year')
        ->and(Terms::money(12500))->toBe('ETB 12,500.00')
        ->and(ReportTable::label('college_name'))->toBe('College');
});

test('an organisation renames its units and currency, and every label follows', function () {
    foreach (['term_college' => 'Faculty', 'term_department' => 'Unit', 'term_academic_year' => 'Fiscal year', 'currency_code' => 'usd', 'currency_name' => 'US Dollars'] as $key => $value) {
        AppSetting::updateOrCreate(['key' => $key], ['value' => $value, 'type' => 'string', 'group' => 'general']);
    }
    Terms::forget();

    expect(Terms::college(true))->toBe('Faculties')
        ->and(Terms::department(true))->toBe('Units')
        ->and(Terms::money(99.5))->toBe('USD 99.50')
        ->and(Terms::currencyName())->toBe('US Dollars')
        ->and(ReportTable::label('college'))->toBe('Faculty')
        ->and(ReportTable::label('academic_year'))->toBe('Fiscal year');
});

test('the terms reach every page and the currency code must be three letters', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->putJson('/api/v1/settings/app/bulk', ['settings' => ['currency_code' => 'DOLLARS']])
        ->assertUnprocessable();

    AppSetting::updateOrCreate(['key' => 'term_college'], ['value' => 'School', 'type' => 'string', 'group' => 'general']);
    Cache::flush();

    $this->get('/login')->assertOk()->assertSee('"term_college":"School"', false);
});
