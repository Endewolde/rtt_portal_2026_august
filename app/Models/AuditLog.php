<?php

namespace App\Models;

use App\Exceptions\LogImmutableException;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'auditable_type',
        'auditable_id',
        'event',
        'actor_id',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::updating(function () {
            throw new LogImmutableException('AuditLog records are immutable and cannot be updated.');
        });

        static::deleting(function () {
            throw new LogImmutableException('AuditLog records are immutable and cannot be deleted.');
        });
    }
}
