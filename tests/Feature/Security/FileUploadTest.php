<?php

use App\Services\FileUploadService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->disk = Storage::fake('private');
});

test('valid PDF file is accepted and stored with UUID filename', function () {
    $service = new FileUploadService;

    // Create a real temp file with PDF header so finfo detects application/pdf
    $tmpPath = tempnam(sys_get_temp_dir(), 'pdf_');
    file_put_contents($tmpPath, '%PDF-1.4 1 0 obj<</Type/Catalog>>endobj');
    $file = new UploadedFile($tmpPath, 'proposal.pdf', 'application/pdf', null, true);

    $path = $service->store($file, 'proposals', ['application/pdf']);

    $this->disk->assertExists($path);
    expect(basename($path))->not->toContain('proposal.pdf');
    expect(basename($path))->toMatch('/^[0-9a-f\-]{36}\.pdf$/i');

    unlink($tmpPath);
});

test('file with PDF extension but wrong MIME type is rejected', function () {
    $service = new FileUploadService;

    // HTML content disguised as PDF — finfo will detect text/html
    $tmpPath = tempnam(sys_get_temp_dir(), 'fake_');
    file_put_contents($tmpPath, '<html><script>alert(1)</script></html>');
    $file = new UploadedFile($tmpPath, 'malicious.pdf', 'application/pdf', null, true);

    expect(fn () => $service->store($file, 'proposals', ['application/pdf']))
        ->toThrow(\InvalidArgumentException::class);

    unlink($tmpPath);
});

test('file over 20MB is rejected', function () {
    $service = new FileUploadService;
    // Create a file slightly over 20MB
    $tmpPath = tempnam(sys_get_temp_dir(), 'big_');
    file_put_contents($tmpPath, str_repeat('X', 21 * 1024 * 1024));
    $file = new UploadedFile($tmpPath, 'big.pdf', 'application/pdf', null, true);

    expect(fn () => $service->store($file, 'proposals'))
        ->toThrow(\InvalidArgumentException::class, 'File size exceeds maximum');

    unlink($tmpPath);
});

test('stored filename is UUID not original filename', function () {
    $service = new FileUploadService;

    $tmpPath = tempnam(sys_get_temp_dir(), 'secret_');
    file_put_contents($tmpPath, '%PDF-1.4 secret content');
    $file = new UploadedFile($tmpPath, 'my_secret_document.pdf', 'application/pdf', null, true);

    $path = $service->store($file, 'proposals', ['application/pdf']);

    expect(basename($path))->not->toContain('my_secret_document');

    unlink($tmpPath);
});
