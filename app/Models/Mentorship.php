<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An experienced researcher guiding another, optionally on a specific proposal. */
class Mentorship extends Model
{
    use HasUuids;

    public const OPEN = ['requested', 'active'];

    protected $fillable = ['mentee_id', 'mentor_id', 'proposal_id', 'status', 'message', 'response', 'responded_at', 'ended_at'];

    protected function casts(): array
    {
        return ['responded_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    public function mentee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentee_id');
    }

    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_id');
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }
}
