<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuditLogger
{
    public static function log(
        string $event,
        string $auditableType,
        string $auditableId,
        ?string $actorId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
    ): void {
        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'event' => $event,
            'actor_id' => $actorId,
            'old_values' => $oldValues ? json_encode($oldValues) : null,
            'new_values' => $newValues ? json_encode($newValues) : null,
            'ip_address' => request()->ip() ?? '127.0.0.1',
            'user_agent' => request()->userAgent() ?? '',
            'created_at' => now(),
        ]);
    }
}
