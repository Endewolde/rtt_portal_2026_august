<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetRevisionRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'proposal_id', 'requested_by', 'reason', 'current_total', 'requested_total',
        'requested_items', 'status', 'resolved_by', 'resolution_notes', 'resolved_at',
    ];

    protected $casts = [
        'current_total' => 'decimal:2',
        'requested_total' => 'decimal:2',
        'requested_items' => 'array',
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
