<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Every outgoing email and whether it was delivered to the mail server — so a broken
 * template or mail configuration shows up on System Monitor instead of going
 * unnoticed while in-app notifications keep working.
 */
class EmailLog extends Model
{
    use HasUuids;

    /** Header the sending jobs set so the log can say what each email was. */
    public const SOURCE_HEADER = 'X-RTT-Source';

    public const UPDATED_AT = null;

    protected $fillable = ['to_email', 'subject', 'source', 'status', 'error'];

    public static function sent(string $to, ?string $subject, ?string $source): void
    {
        self::record($to, $subject, $source, 'sent', null);
    }

    public static function failed(string $to, ?string $subject, ?string $source, \Throwable $e): void
    {
        self::record($to, $subject, $source, 'failed', mb_substr($e->getMessage(), 0, 2000));
    }

    private static function record(string $to, ?string $subject, ?string $source, string $status, ?string $error): void
    {
        // Logging must never break sending (or the request that triggered it).
        try {
            self::create([
                'to_email' => mb_substr($to, 0, 255),
                'subject' => $subject ? mb_substr($subject, 0, 500) : null,
                'source' => $source ? mb_substr($source, 0, 100) : null,
                'status' => $status,
                'error' => $error,
            ]);
        } catch (\Throwable $e) {
            Log::warning("Could not write email log: {$e->getMessage()}");
        }
    }
}
