<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A college officer's request to move one proposal's open defence score deadline,
 * decided by that proposal's category director or the central office.
 */
class DefenceDeadlineExtension extends Model
{
    use HasUuids;

    protected $fillable = [
        'defence_session_id', 'proposal_id', 'requested_by', 'requested_until', 'reason',
        'status', 'granted_until', 'decided_by', 'decision_notes', 'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'requested_until' => 'datetime',
            'granted_until' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    public function defenceSession(): BelongsTo
    {
        return $this->belongsTo(DefenceSession::class);
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
