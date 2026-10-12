<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeadlineExtensionRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'proposal_id', 'requested_by', 'reason', 'requested_until',
        'status', 'resolved_by', 'resolution_notes', 'granted_until', 'resolved_at',
    ];

    protected $casts = [
        'requested_until' => 'datetime',
        'granted_until' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
