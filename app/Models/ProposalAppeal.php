<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalAppeal extends Model
{
    use HasUuids;

    protected $fillable = [
        'proposal_id', 'submitted_by', 'reason',
        'status', 'resolved_by', 'resolution_notes', 'resolved_at',
    ];

    protected $casts = ['resolved_at' => 'datetime'];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
