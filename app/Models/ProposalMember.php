<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalMember extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'user_id',
        'role',
        'contribution_percentage',
        'status',
        'withdrawal_reason',
        'withdrawn_at',
        'joined_at',
    ];

    protected $casts = [
        'contribution_percentage' => 'decimal:2',
        'withdrawn_at'            => 'datetime',
        'joined_at'               => 'datetime',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
