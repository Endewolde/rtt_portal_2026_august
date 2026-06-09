<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalBudget extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'category',
        'item_description',
        'amount',
        'justification',
    ];

    protected $casts = ['amount' => 'decimal:2'];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }
}
