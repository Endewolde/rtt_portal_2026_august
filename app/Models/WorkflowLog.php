<?php

namespace App\Models;

use App\Exceptions\LogImmutableException;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowLog extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'proposal_id',
        'from_stage',
        'action',
        'to_stage',
        'actor_id',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::updating(function () {
            throw new LogImmutableException('WorkflowLog records are immutable and cannot be updated.');
        });

        static::deleting(function () {
            throw new LogImmutableException('WorkflowLog records are immutable and cannot be deleted.');
        });
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
