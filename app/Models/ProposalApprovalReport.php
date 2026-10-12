<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalApprovalReport extends Model
{
    use HasUuids;

    protected $fillable = [
        'proposal_id', 'reported_by', 'reason',
        'status', 'outcome', 'returned_from_status', 'reviewed_by', 'reviewed_at', 'withdrawn_at', 'resolution_notes',
    ];

    protected $casts = ['reviewed_at' => 'datetime', 'withdrawn_at' => 'datetime'];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
