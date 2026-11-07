<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A request to use equipment for a stretch of time: pending → approved or rejected. */
class EquipmentBooking extends Model
{
    use HasUuids;

    /** Statuses that hold the time slot. */
    public const HOLDS_SLOT = ['pending', 'approved'];

    protected $fillable = ['equipment_id', 'user_id', 'proposal_id', 'starts_at', 'ends_at', 'purpose', 'status', 'decision_note', 'decided_by'];

    protected $casts = ['starts_at' => 'datetime', 'ends_at' => 'datetime'];

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }
}
