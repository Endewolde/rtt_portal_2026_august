<?php

use App\Models\AppSetting;
use App\Services\BackupService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->dir = storage_path('app/private/backups');
    @mkdir($this->dir, 0750, true);
    $this->made = [];
    $this->make = function (string $name, string $body) {
        $path = "{$this->dir}/{$name}";
        file_put_contents($path, $body);
        $this->made[] = $path;

        return $path;
    };
});

afterEach(function () {
    foreach ($this->made as $path) {
        @unlink($path);
    }
    if (isset($this->offsite)) {
        exec('rm -rf '.escapeshellarg($this->offsite));
    }
});

test('verification passes a dump that decompresses with its tables and a files archive that opens', function () {
    ($this->make)('rtt_backup_2099-01-01_00-00-00.sql.gz', gzencode("CREATE TABLE `users` (id int);\nCREATE TABLE `proposals` (id int);\n"));
    $src = tempnam(sys_get_temp_dir(), 'f');
    file_put_contents($src, 'document');
    $tar = "{$this->dir}/rtt_files_2099-01-01_00-00-00.tar.gz";
    exec('tar -czf '.escapeshellarg($tar).' -C '.escapeshellarg(dirname($src)).' '.escapeshellarg(basename($src)));
    $this->made[] = $tar;
    touch($tar, time() + 60);

    $result = app(BackupService::class)->verify();

    expect($result['database'])->toStartWith('ok — 2 tables')
        ->and($result['files'])->toStartWith('ok')
        ->and(AppSetting::where('key', 'last_backup_verify_status')->value('value'))->toContain('ok');
});

test('a damaged dump is reported, not trusted', function () {
    $path = ($this->make)('rtt_backup_2099-02-01_00-00-00.sql.gz', 'not gzip at all');
    touch($path, time() + 120);

    expect(app(BackupService::class)->verify()['database'])->toStartWith('corrupt');
});

test('backups are copied to the off-site folder, and a failed copy is recorded instead of breaking the backup', function () {
    ($this->make)('rtt_backup_2099-03-01_00-00-00.sql.gz', gzencode('CREATE TABLE x (id int);'));
    $this->offsite = sys_get_temp_dir().'/rtt-offsite-'.uniqid();
    mkdir($this->offsite);
    AppSetting::updateOrCreate(['key' => 'backup_offsite_path'], ['value' => $this->offsite, 'type' => 'string', 'group' => 'backup']);
    // The uploads mirror is covered by the backups copy succeeding; skip it to keep the test fast.
    AppSetting::updateOrCreate(['key' => 'backup_include_files'], ['value' => 'false', 'type' => 'boolean', 'group' => 'backup']);

    $copy = (new ReflectionMethod(BackupService::class, 'copyOffsite'))->invoke(app(BackupService::class));

    expect($copy)->toBeTrue()
        ->and(file_exists("{$this->offsite}/backups/rtt_backup_2099-03-01_00-00-00.sql.gz"))->toBeTrue()
        ->and(AppSetting::where('key', 'last_offsite_status')->value('value'))->toBe('success');

    AppSetting::where('key', 'backup_offsite_path')->update(['value' => '/nonexistent-root-dir/deeper/still']);
    expect((new ReflectionMethod(BackupService::class, 'copyOffsite'))->invoke(app(BackupService::class)))->toBeFalse()
        ->and(AppSetting::where('key', 'last_offsite_status')->value('value'))->toStartWith('failed');
});
