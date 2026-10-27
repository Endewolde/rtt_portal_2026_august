<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A college's share of a call's funding budget. */
class CallCollegeBudget extends Model
{
    use HasUuids;

    protected $fillable = ['proposal_call_id', 'college_id', 'amount', 'set_by'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function call(): BelongsTo
    {
        return $this->belongsTo(ProposalCall::class, 'proposal_call_id');
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }
}
