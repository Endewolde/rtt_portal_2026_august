<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The one place audit entries are written. Besides who did what to which record,
 * each entry carries the request it came from (method, address, outcome), so an
 * auditor can see how something happened, not only that it did.
 */
class AuditLogger
{
    /** Never written to the log, whatever the request carried. */
    public const SENSITIVE_FIELDS = [
        'password', 'password_confirmation', 'current_password', 'new_password',
        'token', 'secret', 'partial_token', 'api_key', 'client_secret',
    ];

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public static function log(
        string $event,
        string $auditableType,
        string $auditableId,
        ?string $actorId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $statusCode = null,
    ): void {
        $request = app()->runningInConsole() && ! app()->runningUnitTests() ? null : request();

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => Str::limit($auditableType, 100, ''),
            'auditable_id' => Str::limit($auditableId, 36, ''),
            'event' => Str::limit($event, 100, ''),
            'method' => $request?->method(),
            'url' => $request ? Str::limit('/'.ltrim($request->path(), '/'), 500, '') : null,
            'status_code' => $statusCode,
            'actor_id' => $actorId,
            'old_values' => $oldValues ? json_encode(self::scrub($oldValues)) : null,
            'new_values' => $newValues ? json_encode(self::scrub($newValues)) : null,
            'ip_address' => $request?->ip() ?? '127.0.0.1',
            'user_agent' => $request?->userAgent() ?? (app()->runningInConsole() ? 'console' : ''),
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public static function scrub(array $values): array
    {
        foreach ($values as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), self::SENSITIVE_FIELDS, true)) {
                $values[$key] = '[hidden]';
            } elseif (is_array($value)) {
                $values[$key] = self::scrub($value);
            }
        }

        return $values;
    }
}
