<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NoCostExtensionRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'proposal_id', 'requested_by', 'reason', 'current_duration_months', 'requested_duration_months',
        'status', 'resolved_by', 'resolution_notes', 'resolved_at',
    ];

    protected $casts = [
        'current_duration_months' => 'integer',
        'requested_duration_months' => 'integer',
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
