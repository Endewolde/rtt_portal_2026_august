<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('X-Content-Type-Options header is present on web responses', function () {
    $response = $this->get('/');

    $response->assertHeader('X-Content-Type-Options', 'nosniff');
});

test('X-Frame-Options header is SAMEORIGIN', function () {
    $response = $this->get('/');

    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
});

test('X-XSS-Protection header is present', function () {
    $response = $this->get('/');

    $response->assertHeader('X-XSS-Protection', '1; mode=block');
});

test('Content-Security-Policy header is present', function () {
    $response = $this->get('/');

    expect($response->headers->has('Content-Security-Policy'))->toBeTrue();
});

test('Referrer-Policy header is present', function () {
    $response = $this->get('/');

    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
});

test('API responses include security headers', function () {
    $response = $this->getJson('/api/v1/proposal-calls');

    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
});
